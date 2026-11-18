import OpenAI from "openai";
import type {
    StreamChatParams,
    StreamChatResult,
    NormalizedToolCall,
} from "./types";
import { stripProviderPrefix } from "./models";

// ---------------------------------------------------------------------------
// OpenAI-compatible provider adapter (OpenRouter + NVIDIA NIM)
// ---------------------------------------------------------------------------
// Both providers expose the OpenAI Chat Completions schema, so a single
// adapter drives them — only the baseURL/headers/key differ.

const MAX_TOKENS = 16384;

export const OPENROUTER_BASE_URL =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
export const NVIDIA_BASE_URL =
    process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";

export function getOpenAICompatibleClient(
    provider: "openrouter" | "nvidia",
    override?: string | null,
): OpenAI {
    if (provider === "openrouter") {
        const apiKey =
            override?.trim() || process.env.OPENROUTER_API_KEY || "";
        return new OpenAI({
            apiKey,
            baseURL: OPENROUTER_BASE_URL,
            defaultHeaders: {
                "HTTP-Referer": "http://127.0.0.1:3001",
                "X-Title": "MikeOSS Android",
            },
        });
    }

    if (provider === "nvidia") {
        const apiKey = override?.trim() || process.env.NVIDIA_API_KEY || "";
        return new OpenAI({
            apiKey,
            baseURL: NVIDIA_BASE_URL,
        });
    }

    throw new Error(`Unsupported provider: ${provider}`);
}

type ToolCallDeltaChunk = {
    index?: number;
    id?: string;
    function?: { name?: string; arguments?: string };
};

export async function streamOpenAICompat(
    provider: "openrouter" | "nvidia",
    params: StreamChatParams,
): Promise<StreamChatResult> {
    const {
        model,
        systemPrompt,
        tools = [],
        callbacks = {},
        runTools,
        apiKeys,
        enableThinking,
    } = params;
    const maxIter = params.maxIterations ?? 10;
    const apiKeyOverride =
        provider === "openrouter" ? apiKeys?.openrouter : apiKeys?.nvidia;
    const client = getOpenAICompatibleClient(provider, apiKeyOverride);
    const wireModel = stripProviderPrefix(model);

    type NativeMessage = {
        role: "system" | "user" | "assistant" | "tool";
        content: string | null;
        tool_calls?: {
            id: string;
            type: "function";
            function: { name: string; arguments: string };
        }[];
        tool_call_id?: string;
    };

    const messages: NativeMessage[] = [
        { role: "system", content: systemPrompt },
        ...params.messages.map((m) => ({
            role: m.role,
            content: m.content,
        })),
    ];

    let fullText = "";

    for (let iter = 0; iter < maxIter; iter++) {
        const stream = await client.chat.completions.create({
            model: wireModel,
            messages: messages as never,
            stream: true,
            ...(tools.length ? { tools: tools as never } : {}),
            ...(enableThinking
                ? { reasoning_effort: "medium" } as never
                : {}),
        });

        let sawReasoning = false;
        const texts: string[] = [];
        const toolCalls: NormalizedToolCall[] = [];
        const pendingCalls = new Map<
            number,
            { id: string; name: string; args: string }
        >();

        for await (const chunk of stream) {
            const delta =
                (chunk as {
                    choices?: {
                        delta?: {
                            content?: string | null;
                            reasoning?: string | null;
                            reasoning_content?: string | null;
                            tool_calls?: ToolCallDeltaChunk[];
                        };
                    }[];
                }).choices?.[0]?.delta;

            if (!delta) continue;

            const reasoning = delta.reasoning ?? delta.reasoning_content;
            if (reasoning) {
                sawReasoning = true;
                callbacks.onReasoningDelta?.(reasoning);
            }
            if (delta.content) {
                texts.push(delta.content);
                callbacks.onContentDelta?.(delta.content);
            }
            if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                    const slot = tc.index ?? 0;
                    const existing = pendingCalls.get(slot);
                    if (!existing && tc.function?.name) {
                        pendingCalls.set(slot, {
                            id: tc.id ?? `${tc.function.name}-${slot}`,
                            name: tc.function.name,
                            args: tc.function.arguments ?? "",
                        });
                    } else if (existing) {
                        if (tc.id) existing.id = tc.id;
                        if (tc.function?.name) existing.name = tc.function.name;
                        if (tc.function?.arguments) {
                            existing.args += tc.function.arguments;
                        }
                    }
                }
            }
        }

        for (const [, pending] of [...pendingCalls.entries()].sort(
            (a, b) => a[0] - b[0],
        )) {
            let input: Record<string, unknown> = {};
            try {
                input = JSON.parse(pending.args || "{}") as Record<
                    string,
                    unknown
                >;
            } catch {
                input = {};
            }
            const call: NormalizedToolCall = {
                id: pending.id,
                name: pending.name,
                input,
            };
            callbacks.onToolCallStart?.(call);
            toolCalls.push(call);
        }

        if (sawReasoning) callbacks.onReasoningBlockEnd?.();
        fullText += texts.join("");

        const iterationText = texts.join("");
        if (!toolCalls.length || !runTools) break;

        const results = await runTools(toolCalls);

        // Replay the assistant turn carrying its tool calls, then the tool
        // results as role:"tool" messages.
        messages.push({
            role: "assistant",
            content: iterationText || null,
            tool_calls: toolCalls.map((c) => ({
                id: c.id,
                type: "function",
                function: {
                    name: c.name,
                    arguments: JSON.stringify(c.input ?? {}),
                },
            })),
        });
        for (const r of results) {
            messages.push({
                role: "tool",
                tool_call_id: r.tool_use_id,
                content: r.content,
            });
        }
    }

    return { fullText };
}

export async function completeOpenAICompatText(
    provider: "openrouter" | "nvidia",
    params: {
        model: string;
        systemPrompt?: string;
        user: string;
        maxTokens?: number;
        apiKeys?: { openrouter?: string | null; nvidia?: string | null };
    },
): Promise<string> {
    const apiKeyOverride =
        provider === "openrouter"
            ? params.apiKeys?.openrouter
            : params.apiKeys?.nvidia;
    const client = getOpenAICompatibleClient(provider, apiKeyOverride);
    const resp = await client.chat.completions.create({
        model: stripProviderPrefix(params.model),
        max_tokens: params.maxTokens ?? 512,
        messages: [
            ...(params.systemPrompt
                ? [
                      {
                          role: "system" as const,
                          content: params.systemPrompt,
                      },
                  ]
                : []),
            { role: "user" as const, content: params.user },
        ],
    });
    return resp.choices?.[0]?.message?.content ?? "";
}

import { streamClaude, completeClaudeText } from "./claude";
import { streamGemini, completeGeminiText } from "./gemini";
import {
    streamOpenAICompat,
    completeOpenAICompatText,
} from "./openaiCompat";
import { providerForModel } from "./models";
import type { StreamChatParams, StreamChatResult, UserApiKeys } from "./types";

export * from "./types";
export * from "./models";

export async function streamChatWithTools(
    params: StreamChatParams,
): Promise<StreamChatResult> {
    const provider = providerForModel(params.model);
    if (provider === "claude") return streamClaude(params);
    if (provider === "gemini") return streamGemini(params);
    return streamOpenAICompat(provider, params);
}

export async function completeText(params: {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
    apiKeys?: UserApiKeys;
}): Promise<string> {
    const provider = providerForModel(params.model);
    if (provider === "claude") return completeClaudeText(params);
    if (provider === "gemini") return completeGeminiText(params);
    return completeOpenAICompatText(provider, params);
}

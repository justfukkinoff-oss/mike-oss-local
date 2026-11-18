import type { Provider } from "./types";

// ---------------------------------------------------------------------------
// Canonical model IDs
// ---------------------------------------------------------------------------
// Main-chat tier (top-end) — user picks one of these per message.
export const CLAUDE_MAIN_MODELS = ["claude-opus-4-7", "claude-sonnet-4-6"] as const;
export const GEMINI_MAIN_MODELS = [
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
] as const;

// Mid-tier (used for tabular review) — user picks one in account settings.
export const CLAUDE_MID_MODELS = ["claude-sonnet-4-6"] as const;
export const GEMINI_MID_MODELS = ["gemini-3-flash-preview"] as const;

// Low-tier (used for title generation, lightweight extractions) — user picks
// one in account settings.
export const CLAUDE_LOW_MODELS = ["claude-haiku-4-5"] as const;
export const GEMINI_LOW_MODELS = ["gemini-3.1-flash-lite-preview"] as const;

// OpenRouter / NVIDIA NIM — arbitrary OpenAI-compatible model ids, prefixed
// with the provider so `providerForModel()` can route them. Common defaults
// are surfaced in the UI; users can type any custom id too.
export const OPENROUTER_DEFAULT_MODELS = [
    "openrouter/anthropic/claude-3.5-sonnet",
    "openrouter/openai/gpt-4o",
] as const;
export const NVIDIA_DEFAULT_MODELS = [
    "nvidia/meta/llama-3.3-70b-instruct",
    "nvidia/nvidia/llama-3.3-nemotron-super-49b-v1",
] as const;

export const DEFAULT_MAIN_MODEL = "claude-sonnet-4-6";
export const DEFAULT_TITLE_MODEL = "claude-haiku-4-5";
export const DEFAULT_TABULAR_MODEL = "claude-sonnet-4-6";
export const DEFAULT_OPENROUTER_MODEL = "openrouter/anthropic/claude-3.5-sonnet";
export const DEFAULT_NVIDIA_MODEL = "nvidia/meta/llama-3.3-70b-instruct";

const ALL_MODELS = new Set<string>([
    ...CLAUDE_MAIN_MODELS,
    ...GEMINI_MAIN_MODELS,
    ...CLAUDE_MID_MODELS,
    ...GEMINI_MID_MODELS,
    ...CLAUDE_LOW_MODELS,
    ...GEMINI_LOW_MODELS,
]);

// ---------------------------------------------------------------------------
// Provider inference
// ---------------------------------------------------------------------------

export function providerForModel(model: string): Provider {
    if (model.startsWith("openrouter/")) return "openrouter";
    if (model.startsWith("nvidia/")) return "nvidia";
    if (model.startsWith("claude")) return "claude";
    if (model.startsWith("gemini")) return "gemini";
    throw new Error(`Unknown model id: ${model}`);
}

export function stripProviderPrefix(model: string): string {
    if (model.startsWith("openrouter/")) return model.slice("openrouter/".length);
    if (model.startsWith("nvidia/")) return model.slice("nvidia/".length);
    return model;
}

export function resolveModel(id: string | null | undefined, fallback: string): string {
    if (id && ALL_MODELS.has(id)) return id;
    if (id && (id.startsWith("openrouter/") || id.startsWith("nvidia/"))) return id;
    return fallback;
}

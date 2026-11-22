import {
    MODELS,
    type ModelOption,
} from "../components/assistant/ModelToggle";

export type ModelProvider = "claude" | "gemini" | "openrouter" | "nvidia";

export type ModelApiKeys = {
    claudeApiKey: string | null;
    geminiApiKey: string | null;
    openrouterApiKey?: string | null;
    nvidiaApiKey?: string | null;
};

export function getModelProvider(modelId: string): ModelProvider | null {
    if (modelId.startsWith("openrouter/")) return "openrouter";
    if (modelId.startsWith("nvidia/")) return "nvidia";
    const model = MODELS.find((m) => m.id === modelId);
    if (!model) return null;
    switch (model.group) {
        case "Anthropic":
            return "claude";
        case "Google":
            return "gemini";
        case "OpenRouter":
            return "openrouter";
        case "NVIDIA NIM":
            return "nvidia";
        default:
            return null;
    }
}

export function isModelAvailable(modelId: string, apiKeys: ModelApiKeys): boolean {
    const provider = getModelProvider(modelId);
    if (!provider) return false;
    // Claude, OpenRouter, and NVIDIA NIM work either with a key set in the
    // account page or with the backend's env-level key, so they are always
    // offered; Gemini needs a user key.
    if (provider === "claude") return true;
    if (provider === "openrouter") return true;
    if (provider === "nvidia") return true;
    return !!apiKeys.geminiApiKey?.trim();
}

export function isProviderAvailable(
    provider: ModelProvider,
    apiKeys: ModelApiKeys,
): boolean {
    const first = MODELS.find((m) => modelGroupToProvider(m.group) === provider);
    if (first) return isModelAvailable(first.id, apiKeys);
    return true;
}

export function providerLabel(provider: ModelProvider): string {
    switch (provider) {
        case "claude":
            return "Anthropic (Claude)";
        case "gemini":
            return "Google (Gemini)";
        case "openrouter":
            return "OpenRouter";
        case "nvidia":
            return "NVIDIA NIM";
    }
}

export function modelGroupToProvider(
    group: ModelOption["group"],
): ModelProvider {
    switch (group) {
        case "Anthropic":
            return "claude";
        case "Google":
            return "gemini";
        case "OpenRouter":
            return "openrouter";
        case "NVIDIA NIM":
            return "nvidia";
    }
}

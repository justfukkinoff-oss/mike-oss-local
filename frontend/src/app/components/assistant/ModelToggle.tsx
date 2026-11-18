"use client";

import { useState } from "react";
import { ChevronDown, Check, AlertCircle } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    isModelAvailable,
    type ModelApiKeys,
} from "@/app/lib/modelAvailability";

export interface ModelOption {
    id: string;
    label: string;
    group: "Anthropic" | "Google" | "OpenRouter" | "NVIDIA NIM";
}

export const MODELS: ModelOption[] = [
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", group: "Anthropic" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", group: "Anthropic" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", group: "Google" },
    { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", group: "Google" },
    {
        id: "openrouter/anthropic/claude-3.5-sonnet",
        label: "Claude 3.5 Sonnet",
        group: "OpenRouter",
    },
    {
        id: "openrouter/openai/gpt-4o",
        label: "GPT-4o",
        group: "OpenRouter",
    },
    {
        id: "nvidia/meta/llama-3.3-70b-instruct",
        label: "Llama 3.3 70B",
        group: "NVIDIA NIM",
    },
    {
        id: "nvidia/nvidia/llama-3.3-nemotron-super-49b-v1",
        label: "Nemotron Super 49B",
        group: "NVIDIA NIM",
    },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-6";

export function isAllowedModelId(id: string): boolean {
    return (
        MODELS.some((m) => m.id === id) ||
        id.startsWith("openrouter/") ||
        id.startsWith("nvidia/")
    );
}

export const ALLOWED_MODEL_IDS = new Set(MODELS.map((m) => m.id));

const GROUP_ORDER: ModelOption["group"][] = [
    "Anthropic",
    "Google",
    "OpenRouter",
    "NVIDIA NIM",
];

interface Props {
    value: string;
    onChange: (id: string) => void;
    apiKeys?: ModelApiKeys;
}

export function ModelToggle({ value, onChange, apiKeys }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [customOpenRouter, setCustomOpenRouter] = useState("");
    const [customNvidia, setCustomNvidia] = useState("");
    const selected = MODELS.find((m) => m.id === value);
    const selectedLabel = selected?.label ?? value;
    const selectedAvailable = apiKeys
        ? isModelAvailable(value, apiKeys)
        : true;

    const applyCustomOpenRouter = () => {
        const id = customOpenRouter.trim();
        if (!id) return;
        onChange(`openrouter/${id}`);
        setCustomOpenRouter("");
        setIsOpen(false);
    };

    const applyCustomNvidia = () => {
        const id = customNvidia.trim();
        if (!id) return;
        onChange(`nvidia/${id}`);
        setCustomNvidia("");
        setIsOpen(false);
    };

    return (
        <DropdownMenu onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={`flex items-center gap-1.5 rounded-lg px-2 h-8 text-sm transition-colors cursor-pointer text-gray-400 hover:bg-gray-100 hover:text-gray-700 ${isOpen ? "bg-gray-100 text-gray-700" : ""}`}
                    title={
                        !selectedAvailable
                            ? "API key missing for selected model"
                            : "Choose model"
                    }
                >
                    {!selectedAvailable && (
                        <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
                    )}
                    <span className="max-w-[140px] truncate">{selectedLabel}</span>
                    <ChevronDown
                        className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 z-50 max-h-96 overflow-y-auto" side="top" align="start">
                {GROUP_ORDER.map((group, gi) => {
                    const items = MODELS.filter((m) => m.group === group);
                    const isCustomGroup =
                        group === "OpenRouter" || group === "NVIDIA NIM";
                    if (items.length === 0 && !isCustomGroup) return null;
                    return (
                        <div key={group}>
                            {gi > 0 && <DropdownMenuSeparator />}
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-gray-400">
                                {group}
                            </DropdownMenuLabel>
                            {items.map((m) => {
                                const available = apiKeys
                                    ? isModelAvailable(m.id, apiKeys)
                                    : true;
                                return (
                                    <DropdownMenuItem
                                        key={m.id}
                                        className="cursor-pointer"
                                        onSelect={() => onChange(m.id)}
                                    >
                                        <span
                                            className={`flex-1 ${available ? "" : "text-gray-400"}`}
                                        >
                                            {m.label}
                                        </span>
                                        {!available && (
                                            <AlertCircle
                                                className="h-3.5 w-3.5 text-red-500 ml-1"
                                                aria-label="API key missing"
                                            />
                                        )}
                                        {m.id === value && available && (
                                            <Check className="h-3.5 w-3.5 text-gray-600 ml-1" />
                                        )}
                                    </DropdownMenuItem>
                                );
                            })}
                            {isCustomGroup && (
                                <div className="flex items-center gap-1 px-2 py-1.5">
                                    <input
                                        type="text"
                                        value={
                                            group === "OpenRouter"
                                                ? customOpenRouter
                                                : customNvidia
                                        }
                                        onChange={(e) =>
                                            group === "OpenRouter"
                                                ? setCustomOpenRouter(e.target.value)
                                                : setCustomNvidia(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (group === "OpenRouter") {
                                                    applyCustomOpenRouter();
                                                } else {
                                                    applyCustomNvidia();
                                                }
                                            }
                                        }}
                                        placeholder={
                                            group === "OpenRouter"
                                                ? "vendor/custom-model-id\u2026"
                                                : "org/model-name\u2026"
                                        }
                                        className="w-full h-6 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

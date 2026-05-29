// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { Api, Model } from "@earendil-works/pi-ai";
import { completeSimple } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { StreamDebug } from "../state/debug.js";
import {
    cleanLLMOutput,
    extractResultFromJson,
    extractTextFromMessage,
    tryParseJsonResult,
} from "./parse.js";
import { resolveModelId } from "./picker.js";
import {
    buildSystemPrompt,
    readPromptFile,
    truncateToWords,
} from "./prompt.js";

export interface RunPromptResult {
    text: string;
    fullPrompt: string;
    systemPrompt: string;
    debug: StreamDebug;
}

export function thinkingOffOpts(model: Model<Api>): Record<string, unknown> {
    switch (model.api) {
        case "anthropic-messages":
            return { thinkingEnabled: false };
        case "google-generative-ai":
        case "google-vertex":
            return { thinking: { enabled: false } };
        default:
            return {};
    }
}

function maxTokensForSummary(maxWords: number): number {
    // Safety margin: allow ~2 tokens per word + 8 overhead for JSON structure
    return Math.min(128, maxWords * 2 + 8);
}

export async function runPrompt(
    ctx: ExtensionContext,
    fileName: string,
    message: string,
    goal?: string,
): Promise<RunPromptResult> {
    const promptFile = readPromptFile(fileName);
    let instructions = promptFile.instructions;
    let userText = promptFile.template.replace(/\{message\}/g, () => message);
    if (goal !== undefined) {
        instructions = instructions.replace(/\{goal\}/g, () => goal);
        userText = userText.replace(/\{goal\}/g, () => goal);
    }
    instructions = instructions.replace(
        /\{max_words\}/g,
        String(promptFile.maxWords),
    );
    const examples: Record<string, string> = {
        topic: "Rust memory leak",
        achievement: "Fixed JWT middleware in 3 files",
        goal: "Fix the memory leak in the Rust service.",
    };
    const example = examples[fileName] ?? examples.goal;
    const systemPrompt = buildSystemPrompt(
        instructions,
        promptFile.maxWords,
        example,
    );
    const fullPrompt = `${systemPrompt}\n\nMessage: ${userText}`;

    const modelId = resolveModelId(ctx);
    if (!modelId)
        throw new Error("No model available for heading summarization");

    const registry = ctx.modelRegistry;
    const model = registry.getAvailable().find((m) => m.id === modelId);
    if (!model) throw new Error(`Model ${modelId} not found in registry`);

    const auth = await registry.getApiKeyAndHeaders(model);
    if (!auth.ok || !auth.apiKey)
        throw new Error(`No API key available for model ${modelId}`);

    const result = await completeSimple(
        model,
        {
            systemPrompt,
            messages: [
                {
                    role: "user",
                    content: [{ type: "text", text: userText }],
                    timestamp: Date.now(),
                },
            ],
        },
        {
            apiKey: auth.apiKey,
            headers: auth.headers || {},
            maxTokens: maxTokensForSummary(promptFile.maxWords),
            temperature: 0,
            ...thinkingOffOpts(model),
            onPayload: (payload: unknown) => {
                return {
                    ...(payload as Record<string, unknown>),
                    response_format: { type: "json_object" },
                };
            },
        },
    );

    const extracted = extractTextFromMessage(result);
    const cleaned = cleanLLMOutput(extracted);
    // Some models wrap JSON in markdown fences even with response_format: json_object.
    // extractTextFromMessage parses JSON on the raw text; if that failed because of
    // fences, try again after cleanLLMOutput has stripped them.
    // If still failing, use regex extraction as last resort before falling back to raw text.
    let finalText =
        tryParseJsonResult(cleaned) ??
        extractResultFromJson(cleaned) ??
        cleaned;
    // Final safety net: strip any remaining wrapping quotes that survived prefix removal
    // or regex extraction (e.g. malformed JSON where the captured value still starts with ").
    finalText = finalText.replace(/^["']+|["']+$/g, "").trim();
    return {
        text: truncateToWords(finalText, promptFile.maxWords),
        fullPrompt,
        systemPrompt,
        debug: { extractedText: finalText, finalMessageText: extracted },
    };
}

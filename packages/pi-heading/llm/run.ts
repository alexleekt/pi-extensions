// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { Api, Model } from "@earendil-works/pi-ai";
import { completeSimple } from "@earendil-works/pi-ai/compat";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { StreamDebug } from "../state/debug.js";
import {
    cleanLLMOutput,
    extractResultFromJson,
    extractTextFromMessage,
    tryParseJsonResult,
} from "./parse.js";
import { resolveModelRanked } from "./picker.js";
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

function maxTokensForSummary(maxWords: number, model: Model<Api>): number {
    const budget = Math.min(1024, Math.max(512, maxWords * 2 + 8));
    return model.maxTokens ? Math.min(model.maxTokens, budget) : budget;
}

// `response_format: { type: "json_object" }` is an OpenAI *Chat-Completions*
// field. Sending it to any other provider yields an HTTP 400 that completeSimple
// surfaces as an empty-content "error" message — which the caller reads as an
// empty heading and silently drops. Restrict it to chat-completions providers.
export function supportsResponseFormat(model: Model<Api>): boolean {
    return model.api === "openai-completions";
}

// The OpenAI Responses API rejects `temperature` outright (HTTP 400). Every
// other provider we target accepts it. Note: openai-codex-responses is a
// distinct API string and equally rejects it.
export function supportsTemperature(model: Model<Api>): boolean {
    return model.api !== "openai-responses" && model.api !== "openai-codex-responses";
}

class EmptySummaryError extends Error {}

export async function runPrompt(
    ctx: ExtensionContext,
    fileName: string,
    message: string,
    goal?: string,
    context?: string,
): Promise<RunPromptResult> {
    const promptFile = readPromptFile(fileName);
    let instructions = promptFile.instructions;
    let userText = promptFile.template.replace(/\{message\}/g, () => message);
    if (goal !== undefined) {
        instructions = instructions.replace(/\{goal\}/g, () => goal);
        userText = userText.replace(/\{goal\}/g, () => goal);
    }
    if (context !== undefined) {
        instructions = instructions.replace(/\{context\}/g, () => context);
        userText = userText.replace(/\{context\}/g, () => context);
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

    const registry = ctx.modelRegistry;
    const models = resolveModelRanked(ctx, registry.getAvailable(), {
        isUsingOAuth: (model) => registry.isUsingOAuth?.(model) ?? false,
    });
    if (!models.length)
        throw new Error("No model available for heading summarization");

    let lastHardError: unknown;
    let hadEmptyResponse = false;
    for (const model of models.slice(0, 3)) {
        try {
            const auth = await registry.getApiKeyAndHeaders(model);
            if (!auth.ok || !auth.apiKey)
                throw new Error(`No API key available for model ${model.id}`);

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
                    signal: ctx.signal,
                    maxTokens: maxTokensForSummary(promptFile.maxWords, model),
                    ...(supportsTemperature(model) ? { temperature: 0 } : {}),
                    ...thinkingOffOpts(model),
                    ...(model.reasoning &&
                    (model as any).thinkingLevelMap?.off === null
                        ? { reasoning: "low" as const }
                        : {}),
                    onPayload: (payload: unknown) => {
                        const p = payload as Record<string, unknown>;
                        if (!supportsResponseFormat(model)) return p;
                        return {
                            ...p,
                            response_format: { type: "json_object" },
                        };
                    },
                },
            );

            if (result.stopReason === "error")
                throw new Error(result.errorMessage || `Model ${model.id} failed`);
            if (result.stopReason === "aborted")
                throw new DOMException("Heading summarization aborted", "AbortError");

            const extracted = extractTextFromMessage(result);
            const cleaned = cleanLLMOutput(extracted);
            let finalText =
                tryParseJsonResult(cleaned) ??
                extractResultFromJson(cleaned) ??
                cleaned;
            finalText = finalText.replace(/^["']+|["']+$/g, "").trim();
            if (!finalText) {
                // Empty text (e.g. thinking consumed maxTokens) counts as a
                // failed candidate so the loop falls through to the next model.
                throw new EmptySummaryError(`Empty summary from model ${model.id}`);
            }
            return {
                text: truncateToWords(finalText, promptFile.maxWords),
                fullPrompt,
                systemPrompt,
                debug: {
                    extractedText: finalText,
                    finalMessageText: extracted,
                },
            };
        } catch (error) {
            if (ctx.signal?.aborted || (error as Error)?.name === "AbortError")
                throw error;
            if (error instanceof EmptySummaryError) hadEmptyResponse = true;
            else lastHardError = error;
        }
    }
    if (lastHardError) throw lastHardError;
    if (hadEmptyResponse)
        return {
            text: "",
            fullPrompt,
            systemPrompt,
            debug: { extractedText: "", finalMessageText: "" },
        };
    throw new Error("No model available for heading summarization");
}

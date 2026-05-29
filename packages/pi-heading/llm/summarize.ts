// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { StreamDebug } from "../state/debug.js";
import { runPrompt, type RunPromptResult } from "./run.js";

export type { RunPromptResult } from "./run.js";
export { extractTextFromMessage } from "./parse.js";

export interface SummarizeResult {
    topic: string;
    goal: string;
    fullTopicPrompt: string;
    fullGoalPrompt: string;
    topicSystemPrompt: string;
    goalSystemPrompt: string;
    topicDebug: StreamDebug;
    goalDebug: StreamDebug;
}

export async function summarizeAchievement(
    ctx: ExtensionContext,
    assistantText: string,
    goal?: string,
): Promise<RunPromptResult> {
    return runPrompt(ctx, "achievement", assistantText, goal);
}

export async function summarize(
    ctx: ExtensionContext,
    message: string,
): Promise<SummarizeResult> {
    const [topicResult, goalResult] = await Promise.all([
        runPrompt(ctx, "topic", message),
        runPrompt(ctx, "goal", message),
    ]);

    return {
        topic: topicResult.text,
        goal: goalResult.text,
        fullTopicPrompt: topicResult.fullPrompt,
        fullGoalPrompt: goalResult.fullPrompt,
        topicSystemPrompt: topicResult.systemPrompt,
        goalSystemPrompt: goalResult.systemPrompt,
        topicDebug: topicResult.debug,
        goalDebug: goalResult.debug,
    };
}

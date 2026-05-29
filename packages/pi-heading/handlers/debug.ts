// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { SummarizeResult } from "../llm/summarize.js";
import {
  extractTextFromMessage,
} from "../llm/summarize.js";
import type { DebugEntry, StreamDebug } from "../state/debug.js";
import type { State } from "../types.js";

export function baseDebugEntry(
  prompt: string,
  modelId?: string,
): Pick<DebugEntry, "t" | "input" | "prompt" | "modelId"> {
  return {
    t: new Date().toISOString(),
    input: prompt,
    prompt: prompt.slice(0, 200),
    modelId,
  };
}

/** Extract text content from an agent message (assistant or tool result). */
export function extractAgentText(msg: AgentMessage): string {
  return extractTextFromMessage(msg as any);
}

export function makeDebugEntry(
  prompt: string,
  result: SummarizeResult,
  existing: State | undefined,
  modelId?: string,
  stableTopic?: string,
): DebugEntry {
  return {
    ...baseDebugEntry(prompt, modelId),
    fullTopicPrompt: result.fullTopicPrompt,
    fullGoalPrompt: result.fullGoalPrompt,
    topicResponse: result.topic,
    goalResponse: result.goal,
    rawTopic: "",
    rawGoal: "",
    stableTopic: stableTopic ?? existing?.topic ?? "",
    finalGoal: result.goal || (existing?.goal ?? ""),
    topicStream: result.topicDebug,
    goalStream: result.goalDebug,
    topicSystemPrompt: result.topicSystemPrompt,
    goalSystemPrompt: result.goalSystemPrompt,
  };
}

export function makeDebugEntryAchievement(
  assistantText: string,
  result: {
    text: string;
    fullPrompt: string;
    systemPrompt: string;
    debug: unknown;
  },
  existing: State | undefined,
  modelId?: string,
): DebugEntry {
  return {
    ...baseDebugEntry(assistantText.slice(0, 200), modelId),
    fullTopicPrompt: "",
    fullGoalPrompt: "",
    fullAchievementPrompt: result.fullPrompt,
    topicResponse: "",
    goalResponse: "",
    achievementResponse: result.text,
    rawTopic: "",
    rawGoal: "",
    rawAchievement: "",
    stableTopic: existing?.topic ?? "",
    finalGoal: existing?.goal ?? "",
    finalAchievement: result.text,
    topicStream: undefined,
    goalStream: undefined,
    achievementStream: result.debug as StreamDebug | undefined,
    topicSystemPrompt: "",
    goalSystemPrompt: "",
    achievementSystemPrompt: result.systemPrompt,
  };
}

export function makeDebugEntryError(
  prompt: string,
  existing: State | undefined,
  error: string,
  modelId?: string,
): DebugEntry {
  return {
    ...baseDebugEntry(prompt, modelId),
    fullTopicPrompt: "",
    fullGoalPrompt: "",
    topicResponse: "",
    goalResponse: "",
    rawTopic: "",
    rawGoal: "",
    stableTopic: existing?.topic ?? "",
    finalGoal: existing?.goal ?? "",
    error,
  };
}

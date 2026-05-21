// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export const DEBUG_LOG = path.join(
  os.tmpdir(),
  "pi-heading-debug.log",
);

export interface StreamDebug {
  /** Final extracted text from the LLM response (post-extraction, pre-truncation). */
  extractedText: string;
  /** Original final message text before extraction, for deep debugging. */
  finalMessageText?: string;
  /** Error event details if the stream errored. */
  errorEvent?: string;
}

export interface DebugEntry {
  t: string;           // ISO timestamp
  input: string;       // full user input (untruncated)
  prompt: string;      // user prompt (first 200 chars, for quick scan)
  fullTopicPrompt: string; // rendered topic prompt sent to LLM
  fullGoalPrompt: string;  // rendered goal prompt sent to LLM
  fullAchievementPrompt?: string; // rendered achievement prompt sent to LLM
  topicResponse: string;   // final topic text from LLM
  goalResponse: string;    // final goal text from LLM
  achievementResponse?: string; // final achievement text from LLM
  rawTopic: string;    // LLM topic before stabilization
  rawGoal: string;     // LLM goal before truncation
  rawAchievement?: string; // LLM achievement before truncation
  stableTopic: string; // after topic guard
  finalGoal: string;   // after truncation
  finalAchievement?: string; // after truncation
  error?: string;      // if summarization failed
  modelId?: string;    // which model was used
  topicStream?: StreamDebug;  // raw LLM stream for topic prompt
  goalStream?: StreamDebug;   // raw LLM stream for goal prompt
  achievementStream?: StreamDebug; // raw LLM stream for achievement prompt
  /** Exact system prompt sent to the model (for verifying prompt architecture). */
  topicSystemPrompt?: string;
  goalSystemPrompt?: string;
  achievementSystemPrompt?: string;
}

let _debugEnabled = false;

export function setDebugEnabled(enabled: boolean): void {
  _debugEnabled = enabled;
}

export function isDebugEnabled(): boolean {
  return _debugEnabled;
}

/** Append a structured debug entry to the log file. */
export function logDebug(entry: DebugEntry): void {
  if (!_debugEnabled) return;
  try {
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(DEBUG_LOG, line, "utf8");
  } catch {
    // silent fail — debug logging must never break the extension
  }
}

/** Read the last N debug entries (most recent first). */
export function readDebugLog(n: number = 20): DebugEntry[] {
  try {
    const raw = fs.readFileSync(DEBUG_LOG, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    const entries = lines.map((l) => JSON.parse(l) as DebugEntry);
    return entries.slice(-n).reverse();
  } catch {
    return [];
  }
}

/** Clear the debug log. */
export function clearDebugLog(): void {
  try {
    fs.unlinkSync(DEBUG_LOG);
  } catch {
    // ignore
  }
}

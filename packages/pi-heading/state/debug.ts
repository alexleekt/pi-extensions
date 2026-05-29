// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readConfig, writeConfig } from "../util/config.js";

const DEBUG_DIR = path.join(
    os.homedir(),
    ".pi",
    "agent",
    "extensions",
    "pi-heading",
);
export const DEBUG_LOG = path.join(DEBUG_DIR, "debug.log");

export interface StreamDebug {
    /** Final extracted text from the LLM response (post-extraction, pre-truncation). */
    extractedText: string;
    /** Original final message text before extraction, for deep debugging. */
    finalMessageText?: string;
    /** Error event details if the stream errored. */
    errorEvent?: string;
}

export interface DebugEntry {
    t: string; // ISO timestamp
    input: string; // full user input (untruncated)
    prompt: string; // user prompt (first 200 chars, for quick scan)
    fullTopicPrompt: string; // rendered topic prompt sent to LLM
    fullGoalPrompt: string; // rendered goal prompt sent to LLM
    fullAchievementPrompt?: string; // rendered achievement prompt sent to LLM
    topicResponse: string; // final topic text from LLM
    goalResponse: string; // final goal text from LLM
    achievementResponse?: string; // final achievement text from LLM
    rawTopic: string; // LLM topic before stabilization
    rawGoal: string; // LLM goal before truncation
    rawAchievement?: string; // LLM achievement before truncation
    stableTopic: string; // after topic guard
    finalGoal: string; // after truncation
    finalAchievement?: string; // after truncation
    error?: string; // if summarization failed
    modelId?: string; // which model was used
    topicStream?: StreamDebug; // raw LLM stream for topic prompt
    goalStream?: StreamDebug; // raw LLM stream for goal prompt
    achievementStream?: StreamDebug; // raw LLM stream for achievement prompt
    /** Exact system prompt sent to the model (for verifying prompt architecture). */
    topicSystemPrompt?: string;
    goalSystemPrompt?: string;
    achievementSystemPrompt?: string;
}

let _debugEnabled = false;
let _debugLogPath = DEBUG_LOG;

export function setDebugEnabled(enabled: boolean): void {
    _debugEnabled = enabled;
}

export function isDebugEnabled(): boolean {
    return _debugEnabled;
}

export function setDebugLogPath(path: string): void {
    _debugLogPath = path;
}

export function getDebugLogPath(): string {
    return _debugLogPath;
}

interface DebugConfig {
    debug?: boolean;
}

const DEFAULT_CONFIG_DIR = path.join(
    os.homedir(),
    ".pi",
    "agent",
    "extensions",
    "pi-heading",
);

export function getDebugMode(dir?: string): boolean {
    const cfg = readConfig<DebugConfig>(dir ?? DEFAULT_CONFIG_DIR, {});
    return cfg.debug === true;
}

export function setDebugMode(enabled: boolean, dir?: string): void {
    writeConfig<DebugConfig>(dir ?? DEFAULT_CONFIG_DIR, "debug", enabled);
}

const MAX_LOG_BYTES = 1024 * 1024; // 1 MB

/** Ensure the debug directory exists with restrictive permissions. */
function ensureDebugDir(): void {
    try {
        fs.mkdirSync(DEBUG_DIR, { recursive: true, mode: 0o700 });
    } catch {
        // silent fail
    }
}

/** Rotate the log by dropping the oldest half of entries when it exceeds the size limit. */
function rotateLogIfNeeded(): void {
    ensureDebugDir();
    try {
        const stats = fs.statSync(_debugLogPath);
        if (stats.size <= MAX_LOG_BYTES) return;
    } catch {
        return; // file doesn't exist yet
    }
    try {
        const raw = fs.readFileSync(_debugLogPath, "utf8");
        const lines = raw.trim().split("\n").filter(Boolean);
        const keepFrom = Math.floor(lines.length / 2);
        const trimmed = `${lines.slice(keepFrom).join("\n")}\n`;
        fs.writeFileSync(_debugLogPath, trimmed, {
            encoding: "utf8",
            mode: 0o600,
        });
    } catch {
        // silent fail
    }
}

/** Append a structured debug entry to the log file. */
export function logDebug(entry: DebugEntry): void {
    if (!_debugEnabled) return;
    try {
        rotateLogIfNeeded();
        ensureDebugDir();
        const line = `${JSON.stringify(entry)}\n`;
        fs.appendFileSync(_debugLogPath, line, {
            encoding: "utf8",
            mode: 0o600,
        });
    } catch {
        // silent fail — debug logging must never break the extension
    }
}

/** Read the last N debug entries (most recent first). */
export function readDebugLog(n: number = 20): DebugEntry[] {
    try {
        const raw = fs.readFileSync(_debugLogPath, "utf8");
        const lines = raw.trim().split("\n").filter(Boolean);
        const entries = lines.map((l) => JSON.parse(l) as DebugEntry);
        const limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
        return entries.slice(-limit).reverse();
    } catch {
        return [];
    }
}

/** Clear the debug log. */
export function clearDebugLog(): void {
    try {
        fs.unlinkSync(_debugLogPath);
    } catch {
        // ignore
    }
}

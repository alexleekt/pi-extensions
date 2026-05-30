// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
    clearDebugLog,
    DEBUG_LOG,
    getDebugLogPath,
    isDebugEnabled,
    logDebug,
    readDebugLog,
    setDebugEnabled,
    setDebugLogPath,
} from "./debug.js";

function makeEntry(input: string): {
    t: string;
    input: string;
    prompt: string;
    fullTopicPrompt: string;
    fullGoalPrompt: string;
    topicResponse: string;
    goalResponse: string;
    rawTopic: string;
    rawGoal: string;
    stableTopic: string;
    finalGoal: string;
    topicSystemPrompt: string;
    goalSystemPrompt: string;
} {
    return {
        t: new Date().toISOString(),
        input,
        prompt: "",
        fullTopicPrompt: "",
        fullGoalPrompt: "",
        topicResponse: "",
        goalResponse: "",
        rawTopic: "",
        rawGoal: "",
        stableTopic: "",
        finalGoal: "",
        topicSystemPrompt: "",
        goalSystemPrompt: "",
    };
}

describe("debug", () => {
    let tmpDir: string;
    let tmpLog: string;
    let originalLogPath: string;

    beforeEach(() => {
        tmpDir = path.join(
            os.tmpdir(),
            `pi-heading-debug-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        fs.mkdirSync(tmpDir, { recursive: true });
        tmpLog = path.join(tmpDir, "debug.log");
        originalLogPath = getDebugLogPath();
        setDebugLogPath(tmpLog);
        setDebugEnabled(false);
    });

    afterEach(() => {
        setDebugLogPath(originalLogPath);
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            // ignore
        }
    });

    test("setDebugEnabled / isDebugEnabled round-trip", () => {
        setDebugEnabled(true);
        expect(isDebugEnabled()).toBe(true);
        setDebugEnabled(false);
        expect(isDebugEnabled()).toBe(false);
    });

    test("logDebug is no-op when disabled", () => {
        setDebugEnabled(false);
        logDebug(makeEntry("test"));
        expect(readDebugLog(1)).toEqual([]);
    });

    test("logDebug appends structured entry when enabled", () => {
        setDebugEnabled(true);
        logDebug(makeEntry("test input"));
        const entries = readDebugLog(1);
        expect(entries.length).toBe(1);
        expect(entries[0].input).toBe("test input");
    });

    test("readDebugLog returns last N entries (most recent first)", () => {
        setDebugEnabled(true);
        for (let i = 0; i < 5; i++) {
            logDebug(makeEntry(`entry ${i}`));
        }
        const entries = readDebugLog(3);
        expect(entries.length).toBe(3);
        expect(entries[0].input).toBe("entry 4");
        expect(entries[1].input).toBe("entry 3");
        expect(entries[2].input).toBe("entry 2");
    });

    test("readDebugLog handles empty file", () => {
        expect(readDebugLog(10)).toEqual([]);
    });

    test("readDebugLog skips malformed JSON lines and returns valid entries", () => {
        setDebugEnabled(true);
        fs.writeFileSync(tmpLog, "not json\n", "utf8");
        logDebug(makeEntry("valid"));
        const entries = readDebugLog(10);
        expect(entries.length).toBe(1);
        expect(entries[0].input).toBe("valid");
    });

    test("clearDebugLog removes file", () => {
        setDebugEnabled(true);
        logDebug(makeEntry("test"));
        expect(readDebugLog(1).length).toBe(1);
        clearDebugLog();
        expect(readDebugLog(1)).toEqual([]);
    });

    test("clearDebugLog on non-existing file does not throw", () => {
        expect(() => clearDebugLog()).not.toThrow();
    });

    test("log rotation drops oldest half when > 1MB", () => {
        setDebugEnabled(true);
        const largeEntry = {
            ...makeEntry("x"),
            input: "x".repeat(1000),
        };
        // Write enough entries to exceed 1MB
        const targetSize = 1024 * 1024 + 100;
        let count = 0;
        while (true) {
            logDebug({ ...largeEntry, t: `2026-05-20T12:00:${count++}Z` });
            const size = fs.statSync(tmpLog).size;
            if (size >= targetSize) break;
        }
        const beforeCount = readDebugLog(10000).length;
        // Trigger rotation
        logDebug({ ...largeEntry, t: "2026-05-20T12:00:99Z" });
        const afterCount = readDebugLog(10000).length;
        // After rotation, should have roughly half the entries + 1 new
        expect(afterCount).toBeLessThan(beforeCount);
        expect(afterCount).toBeGreaterThan(0);
    });

    test("readDebugLog default n=20", () => {
        setDebugEnabled(true);
        for (let i = 0; i < 25; i++) {
            logDebug(makeEntry(`entry ${i}`));
        }
        const entries = readDebugLog();
        expect(entries.length).toBe(20);
    });

    test("getDebugLogPath / setDebugLogPath round-trip", () => {
        expect(getDebugLogPath()).toBe(tmpLog);
        setDebugLogPath(originalLogPath);
        expect(getDebugLogPath()).toBe(originalLogPath);
    });

    test("DEBUG_LOG constant is under private debug dir", () => {
        expect(DEBUG_LOG).toContain(
            ".pi/agent/extensions/pi-heading/debug.log",
        );
    });
});

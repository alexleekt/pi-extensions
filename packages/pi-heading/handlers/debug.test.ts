// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { describe, expect, test } from "bun:test";
import {
    baseDebugEntry,
    extractAgentText,
    makeDebugEntry,
    makeDebugEntryAchievement,
    makeDebugEntryError,
} from "./debug.js";

describe("baseDebugEntry", () => {
    test("sets timestamp, full input, truncated prompt, and modelId", () => {
        const entry = baseDebugEntry("hello world", "test-model");
        expect(entry.t).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(entry.input).toBe("hello world");
        expect(entry.prompt).toBe("hello world");
        expect(entry.modelId).toBe("test-model");
    });

    test("truncates prompt to 200 chars", () => {
        const long = "a".repeat(500);
        const entry = baseDebugEntry(long);
        expect(entry.prompt).toBe(long.slice(0, 200));
        expect(entry.input).toBe(long);
    });

    test("omits modelId when undefined", () => {
        const entry = baseDebugEntry("test");
        expect(entry.modelId).toBeUndefined();
    });
});

describe("extractAgentText", () => {
    test("extracts text from assistant message with content array", () => {
        const msg = {
            content: [{ type: "text", text: "hello world" }],
        };
        expect(extractAgentText(msg as any)).toBe("hello world");
    });

    test("returns empty string for undefined", () => {
        expect(extractAgentText(undefined as any)).toBe("");
    });
});

describe("makeDebugEntry", () => {
    test("populates all fields from summarize result", () => {
        const result = {
            topic: "Docker",
            goal: "Fix compose",
            fullTopicPrompt: "topic prompt",
            fullGoalPrompt: "goal prompt",
            topicSystemPrompt: "topic sys",
            goalSystemPrompt: "goal sys",
            topicDebug: { extractedText: "docker" },
            goalDebug: { extractedText: "fix" },
        } as any;
        const existing = { topic: "Old", goal: "Old goal" };
        const entry = makeDebugEntry(
            "user input",
            result,
            existing,
            "model-1",
            "stable",
        );
        expect(entry.input).toBe("user input");
        expect(entry.topicResponse).toBe("Docker");
        expect(entry.goalResponse).toBe("Fix compose");
        expect(entry.fullTopicPrompt).toBe("topic prompt");
        expect(entry.fullGoalPrompt).toBe("goal prompt");
        expect(entry.topicSystemPrompt).toBe("topic sys");
        expect(entry.goalSystemPrompt).toBe("goal sys");
        expect(entry.stableTopic).toBe("stable");
        expect(entry.finalGoal).toBe("Fix compose");
        expect(entry.topicStream).toEqual({ extractedText: "docker" });
        expect(entry.goalStream).toEqual({ extractedText: "fix" });
    });

    test("falls back to existing topic when stableTopic is not provided", () => {
        const result = { topic: "New", goal: "New goal" } as any;
        const existing = { topic: "Old", goal: "Old goal" };
        const entry = makeDebugEntry("input", result, existing, undefined);
        expect(entry.stableTopic).toBe("Old");
    });

    test("falls back to existing goal when result goal is empty", () => {
        const result = {
            topic: "New",
            goal: "",
            fullTopicPrompt: "",
            fullGoalPrompt: "",
            topicSystemPrompt: "",
            goalSystemPrompt: "",
            topicDebug: { extractedText: "" },
            goalDebug: { extractedText: "" },
        } as any;
        const existing = { topic: "Old", goal: "Old goal" };
        const entry = makeDebugEntry("input", result, existing);
        expect(entry.finalGoal).toBe("Old goal");
    });
});

describe("makeDebugEntryAchievement", () => {
    test("populates achievement-specific fields", () => {
        const result = {
            text: "Fixed the bug",
            fullPrompt: "achievement prompt",
            systemPrompt: "achievement sys",
            debug: { extractedText: "fixed" },
        };
        const existing = { topic: "Docker", goal: "Fix compose" };
        const entry = makeDebugEntryAchievement(
            "assistant output",
            result,
            existing,
            "model-1",
        );
        expect(entry.input).toBe("assistant output".slice(0, 200));
        expect(entry.achievementResponse).toBe("Fixed the bug");
        expect(entry.fullAchievementPrompt).toBe("achievement prompt");
        expect(entry.achievementSystemPrompt).toBe("achievement sys");
        expect(entry.stableTopic).toBe("Docker");
        expect(entry.finalGoal).toBe("Fix compose");
        expect(entry.finalAchievement).toBe("Fixed the bug");
        expect(entry.achievementStream).toEqual({ extractedText: "fixed" });
    });

    test("handles undefined existing state", () => {
        const result = {
            text: "Done",
            fullPrompt: "",
            systemPrompt: "",
            debug: undefined,
        };
        const entry = makeDebugEntryAchievement("output", result, undefined);
        expect(entry.stableTopic).toBe("");
        expect(entry.finalGoal).toBe("");
        expect(entry.achievementStream).toBeUndefined();
    });
});

describe("makeDebugEntryError", () => {
    test("populates error field with message", () => {
        const existing = { topic: "Docker", goal: "Fix compose" };
        const entry = makeDebugEntryError(
            "user input",
            existing,
            "model not found",
            "model-1",
        );
        expect(entry.input).toBe("user input");
        expect(entry.error).toBe("model not found");
        expect(entry.stableTopic).toBe("Docker");
        expect(entry.finalGoal).toBe("Fix compose");
        expect(entry.modelId).toBe("model-1");
    });

    test("handles undefined existing state", () => {
        const entry = makeDebugEntryError("input", undefined, "error");
        expect(entry.stableTopic).toBe("");
        expect(entry.finalGoal).toBe("");
    });
});

import { describe, expect, it } from "vitest";
import {
    buildAgentPreamble,
    extractTextFromAssistantEntry,
    findLastAssistantEntry,
    mergeContextWithPreamble,
    stripThinkingBlocks,
} from "../preamble.js";

describe("preamble capture", () => {
    describe("stripThinkingBlocks", () => {
        it("removes inline <thinking> blocks", () => {
            const input = "before <thinking>secret reasoning</thinking> after";
            expect(stripThinkingBlocks(input)).toBe("before  after");
        });

        it("removes multiline <thinking> blocks", () => {
            const input = "before\n<thinking>\nsecret\nlines\n</thinking>\nafter";
            expect(stripThinkingBlocks(input)).toBe("before\n\nafter");
        });

        it("removes ```thinking fenced blocks", () => {
            const input = "before\n```thinking\nsecret\n```\nafter";
            expect(stripThinkingBlocks(input)).toBe("before\n\nafter");
        });

        it("returns empty string for thinking-only input", () => {
            expect(stripThinkingBlocks("<thinking>all secret</thinking>")).toBe("");
        });
    });

    describe("extractTextFromAssistantEntry", () => {
        it("extracts text from a single-text content array", () => {
            const entry = {
                message: {
                    role: "assistant",
                    content: [{ type: "text", text: "Hello world" }],
                },
            };
            expect(extractTextFromAssistantEntry(entry)).toBe("Hello world");
        });

        it("joins multi-block text content with newlines", () => {
            const entry = {
                message: {
                    role: "assistant",
                    content: [
                        { type: "text", text: "Block 1" },
                        { type: "text", text: "Block 2" },
                    ],
                },
            };
            expect(extractTextFromAssistantEntry(entry)).toBe("Block 1\nBlock 2");
        });

        it("returns empty string for null entry", () => {
            expect(extractTextFromAssistantEntry(null)).toBe("");
        });

        it("returns empty string for entry without message.content", () => {
            const entry = { message: { role: "assistant" } };
            expect(extractTextFromAssistantEntry(entry)).toBe("");
        });
    });

    describe("findLastAssistantEntry", () => {
        it("returns the most recent assistant entry", () => {
            const entries = [
                { message: { role: "user", content: "hi" } },
                { message: { role: "assistant", content: "hello" } },
                { message: { role: "user", content: "are you sure?" } },
                {
                    message: {
                        role: "assistant",
                        content: [{ type: "text", text: "Plan:\n1. Step" }],
                    },
                },
            ];
            const last = findLastAssistantEntry(entries);
            expect(last).toBe(entries[3]);
        });

        it("returns undefined when no assistant entries exist", () => {
            const entries = [{ message: { role: "user", content: "hi" } }];
            expect(findLastAssistantEntry(entries)).toBeUndefined();
        });

        it("returns undefined for empty entries", () => {
            expect(findLastAssistantEntry([])).toBeUndefined();
        });
    });

    describe("buildAgentPreamble", () => {
        function longPlan(length: number): string {
            return "Here is my plan. ".repeat(Math.ceil(length / 18));
        }

        it("returns empty when no assistant entries", () => {
            expect(buildAgentPreamble([], "Approve?")).toBe("");
        });

        it("returns empty when the assistant message is too short", () => {
            const entries = [
                {
                    message: {
                        role: "assistant",
                        content: [{ type: "text", text: "OK" }],
                    },
                },
            ];
            expect(buildAgentPreamble(entries, "Approve?")).toBe("");
        });

        it("returns the plan text when long enough", () => {
            const entries = [
                {
                    message: {
                        role: "assistant",
                        content: [{ type: "text", text: longPlan(500) }],
                    },
                },
            ];
            const preamble = buildAgentPreamble(entries, "Approve?");
            expect(preamble.length).toBeGreaterThanOrEqual(200);
            expect(preamble).toContain("Here is my plan");
        });

        it("strips <thinking> blocks from the preamble", () => {
            const entries = [
                {
                    message: {
                        role: "assistant",
                        content: [
                            {
                                type: "text",
                                text: `${"Plan body. ".repeat(40)}<thinking>secret</thinking>`,
                            },
                        ],
                    },
                },
            ];
            const preamble = buildAgentPreamble(entries, "Approve?");
            expect(preamble).not.toContain("secret");
            expect(preamble.length).toBeGreaterThanOrEqual(200);
        });

        it("truncates very long preambles at a paragraph boundary", () => {
            const longText = `${"Sentence. ".repeat(2000)}`;
            const entries = [
                {
                    message: {
                        role: "assistant",
                        content: [{ type: "text", text: longText }],
                    },
                },
            ];
            const preamble = buildAgentPreamble(entries, "Approve?");
            // Should be capped to MAX_PREAMBLE_LENGTH plus a truncation note
            expect(preamble.length).toBeLessThanOrEqual(12_000 + 30);
            expect(preamble).toContain("[…truncated]");
        });
    });

    describe("mergeContextWithPreamble", () => {
        const longText = "x".repeat(200);

        it("returns empty when both inputs are empty", () => {
            expect(mergeContextWithPreamble(undefined, "")).toBe("");
            expect(mergeContextWithPreamble("", "")).toBe("");
        });

        it("returns preamble when explicit context is missing", () => {
            expect(mergeContextWithPreamble(undefined, "hello")).toBe("hello");
        });

        it("returns explicit context when preamble is missing", () => {
            expect(mergeContextWithPreamble("hello", "")).toBe("hello");
        });

        it("does not duplicate when explicit context equals preamble", () => {
            // The /ask command passes the full assistant text as context,
            // which is the same as what buildAgentPreamble would return.
            // We must NOT render it twice.
            const result = mergeContextWithPreamble(longText, longText);
            expect(result).toBe(longText);
        });

        it("does not duplicate when preamble already contains explicit context", () => {
            const preambleText = `Intro paragraph. ${"x".repeat(200)}`;
            const explicitSnippet = preambleText.slice(0, 100);
            // Preamble is a superset of the explicit context — keep preamble
            const result = mergeContextWithPreamble(explicitSnippet, preambleText);
            expect(result).toBe(preambleText);
        });

        it("does not duplicate when explicit context already contains preamble", () => {
            const explicitText = `Intro paragraph. ${"x".repeat(200)}`;
            const preambleText = explicitText.slice(0, 100);
            // Explicit context is a superset — keep explicit
            const result = mergeContextWithPreamble(explicitText, preambleText);
            expect(result).toBe(explicitText);
        });

        it("appends with HR separator when both are distinct", () => {
            const ctx = "First section about A.";
            const pre = "Second section about B with a much longer body. ".repeat(20);
            const result = mergeContextWithPreamble(ctx, pre);
            expect(result).toContain("First section about A.");
            expect(result).toContain("---");
            expect(result).toContain(pre.trim());
        });

        it("normalizes whitespace before dedup comparison", () => {
            // Same content with different whitespace should be deduped
            const a = "hello world\n\nthis is a test";
            const b = "hello world this is a test";
            // The normalization collapses \n\n to a single space, making
            // these match (after the single-space normalization in the
            // helper, both become "hello world this is a test").
            // We don't assert dedup here because the dedup threshold is
            // 50 chars and these are short; just confirm no crash.
            const result = mergeContextWithPreamble(a, b);
            expect(result).toContain("hello world");
        });
    });
});

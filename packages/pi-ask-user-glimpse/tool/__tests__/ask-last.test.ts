import { afterEach, describe, expect, it } from "vitest";
import {
    answerPrefix,
    buildAskLastFallbackParams,
    buildAskLastParams,
    validateAskLastParams,
} from "../ask-last.js";

const ctx = {} as Parameters<typeof buildAskLastParams>[1];

afterEach(() => {
    delete process.env.PI_ASK_USER_CLEANUP_COMMAND;
});

describe("buildAskLastFallbackParams", () => {
    it("creates a freeform dialog with stripped assistant context", () => {
        const params = buildAskLastFallbackParams(
            "Before<thinking>secret reasoning</thinking>After",
        );

        expect(params).toMatchObject({
            question: "The assistant would like your input on the following:",
            allowFreeform: true,
        });
        expect(params.context).toContain("Before");
        expect(params.context).toContain("After");
        expect(params.context).not.toContain("secret reasoning");
    });
});

describe("validateAskLastParams", () => {
    it("accepts a structured single-select payload", () => {
        const params = validateAskLastParams(
            {
                question: "Which path should we take?",
                options: [
                    { title: "Small cleanup", recommended: true },
                    { title: "Full rewrite", description: "More risk" },
                ],
                allowFreeform: false,
                allowComment: true,
            },
            "original assistant text",
        );

        expect(params).toMatchObject({
            question: "Which path should we take?",
            allowFreeform: false,
            allowComment: true,
            options: [
                { title: "Small cleanup", recommended: true },
                { title: "Full rewrite", description: "More risk" },
            ],
        });
    });

    it("accepts a questionnaire payload and defaults allowSkip", () => {
        const params = validateAskLastParams(
            {
                question: "Clarify implementation details",
                questions: [
                    { title: "Scope", description: "What should change?" },
                    {
                        title: "Debug command",
                        options: [{ title: "Env gate" }, { title: "Remove" }],
                    },
                ],
            },
            "original assistant text",
        );

        expect(params?.questions).toHaveLength(2);
        expect(params?.allowSkip).toBe(true);
    });

    it("rejects invalid payloads", () => {
        expect(
            validateAskLastParams({ options: [{ title: "A" }] }, "text"),
        ).toBeNull();
        expect(validateAskLastParams(null, "text")).toBeNull();
    });
});

describe("buildAskLastParams", () => {
    it("falls back when no cleanup provider is configured", async () => {
        const params = await buildAskLastParams("Please pick a path.", ctx);
        expect(params.question).toBe(
            "The assistant would like your input on the following:",
        );
        expect(params.allowFreeform).toBe(true);
    });

    it("uses an explicit cleanup command when it returns valid JSON", async () => {
        process.env.PI_ASK_USER_CLEANUP_COMMAND =
            "node -e \"process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write(JSON.stringify({question:'Pick one',options:[{title:'A'},{title:'B'}],allowFreeform:false})))\"";

        const params = await buildAskLastParams("Assistant text", ctx);
        expect(params).toMatchObject({
            question: "Pick one",
            allowFreeform: false,
            options: [{ title: "A" }, { title: "B" }],
        });
    });

    it("falls back when explicit cleanup command returns invalid JSON", async () => {
        process.env.PI_ASK_USER_CLEANUP_COMMAND =
            "node -e \"process.stdout.write('not json')\"";

        const params = await buildAskLastParams("Assistant text", ctx);
        expect(params.question).toBe(
            "The assistant would like your input on the following:",
        );
    });
});

describe("answerPrefix", () => {
    it("uses plural wording for multi-question payloads", () => {
        expect(
            answerPrefix({
                question: "Multiple questions",
                questions: [{ title: "A" }, { title: "B" }],
            }),
        ).toBe("Answering the questions from your last message:");
    });

    it("uses generic wording for freeform payloads", () => {
        expect(answerPrefix({ question: "Open", allowFreeform: true })).toBe(
            "Responding to your last message:",
        );
    });
});

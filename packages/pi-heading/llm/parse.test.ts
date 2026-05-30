// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { describe, expect, test } from "bun:test";
import {
    cleanLLMOutput,
    extractResultFromJson,
    extractTextFromMessage,
    tryParseJsonResult,
} from "./parse.js";

describe("tryParseJsonResult", () => {
    test("extracts string result from valid JSON", () => {
        expect(tryParseJsonResult('{"result": "hello"}')).toBe("hello");
    });

    test("returns undefined for invalid JSON", () => {
        expect(tryParseJsonResult("not json")).toBeUndefined();
    });

    test("returns undefined when result key is missing", () => {
        expect(tryParseJsonResult('{"other": "hello"}')).toBeUndefined();
    });

    test("coerces non-string result value to string", () => {
        expect(tryParseJsonResult('{"result": 42}')).toBe("42");
        expect(tryParseJsonResult('{"result": true}')).toBe("true");
    });

    test("returns undefined for null result", () => {
        expect(tryParseJsonResult('{"result": null}')).toBeUndefined();
    });
});

describe("extractResultFromJson", () => {
    test("extracts quoted result value", () => {
        expect(extractResultFromJson('{"result": "hello world"}')).toBe(
            "hello world",
        );
    });

    test("extracts unquoted result value", () => {
        expect(extractResultFromJson('{"result": hello}')).toBe("hello");
    });

    test("handles trailing junk after JSON", () => {
        expect(extractResultFromJson('{"result": "hello"} extra text')).toBe(
            "hello",
        );
    });

    test("unescapes escaped quotes in result", () => {
        expect(extractResultFromJson('{"result": "say \\"hello\\""}')).toBe(
            'say "hello"',
        );
    });

    test("unescapes escaped newlines", () => {
        expect(extractResultFromJson('{"result": "line one\\nline two"}')).toBe(
            "line one line two",
        );
    });

    test("returns undefined for non-matching text", () => {
        expect(extractResultFromJson("not json at all")).toBeUndefined();
    });

    test("returns undefined when result key is missing", () => {
        expect(extractResultFromJson('{"other": "value"}')).toBeUndefined();
    });

    test("handles malformed JSON missing closing brace", () => {
        expect(extractResultFromJson('{"result": "hello"')).toBe("hello");
    });
});

describe("cleanLLMOutput edge cases", () => {
    test("strips quotes after prefix removal with nested quotes", () => {
        expect(cleanLLMOutput('The user wants to "Fix the bug"')).toBe(
            "Fix the bug",
        );
    });

    test("handles empty string", () => {
        expect(cleanLLMOutput("")).toBe("");
    });

    test("handles whitespace-only", () => {
        expect(cleanLLMOutput("   ")).toBe("");
    });

    test("preserves already clean text", () => {
        expect(cleanLLMOutput("Clean text")).toBe("Clean text");
    });
});

describe("extractTextFromMessage edge cases", () => {
    test("handles empty content array", () => {
        expect(extractTextFromMessage({ content: [] } as any)).toBe("");
    });

    test("handles mixed content with only thinking", () => {
        expect(
            extractTextFromMessage({
                content: [{ type: "thinking", thinking: "think" }],
            } as any),
        ).toBe("");
    });

    test("handles nested JSON with result field", () => {
        expect(
            extractTextFromMessage({
                content: [{ type: "text", text: '{"result": "nested"}' }],
            } as any),
        ).toBe("nested");
    });
});

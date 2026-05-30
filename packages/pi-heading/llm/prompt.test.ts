// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { describe, expect, test } from "bun:test";
import { buildSystemPrompt } from "./prompt.js";

describe("buildSystemPrompt", () => {
    test("includes instructions and maxWords in output", () => {
        const result = buildSystemPrompt(
            "Summarize the message.",
            5,
            "hello world",
        );
        expect(result).toContain("Summarize the message.");
        expect(result).toContain("5");
        expect(result).toContain("hello world");
    });

    test("includes strict format rules", () => {
        const result = buildSystemPrompt("Do a thing.", 3, "example");
        expect(result).toContain("STRICT FORMAT RULES");
        expect(result).toContain('"result"');
        expect(result).toContain("3 words or fewer");
    });

    test("includes the example in the JSON template", () => {
        const result = buildSystemPrompt("Tag the topic.", 4, "Rust memory");
        expect(result).toContain('{"result": "Rust memory"}');
    });
});

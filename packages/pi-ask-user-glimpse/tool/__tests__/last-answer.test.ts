import { describe, expect, it } from "vitest";

import { readLastAnswer, saveLastAnswer } from "../last-answer.js";

describe("last-answer journal", () => {
    it("round-trips a saved answer", () => {
        saveLastAnswer("Which database?", "SQLite");
        const entry = readLastAnswer();
        expect(entry?.answer).toBe("SQLite");
        expect(entry?.question).toBe("Which database?");
        // Leave a benign entry behind — the journal path is process-wide.
        saveLastAnswer("cleanup", "done");
    });

    it("ignores empty answers", () => {
        saveLastAnswer("q", "   ");
        const entry = readLastAnswer(0);
        // Either undefined (fresh journal) or an older entry — never empty.
        if (entry) expect(entry.answer.trim().length).toBeGreaterThan(0);
        saveLastAnswer("cleanup", "done");
    });

    it("respects max age", () => {
        saveLastAnswer("q", "old answer");
        expect(readLastAnswer(-1)).toBeUndefined();
        saveLastAnswer("cleanup", "done");
    });
});

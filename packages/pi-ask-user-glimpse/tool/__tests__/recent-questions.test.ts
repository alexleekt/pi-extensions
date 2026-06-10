import { describe, expect, it } from "vitest";
import {
    entriesFromAskUserCall,
    makeRecentQuestionsStore,
    type RecentQuestion,
} from "../recent-questions.js";

function entry(overrides: Partial<RecentQuestion> = {}): RecentQuestion {
    return {
        header: "Database",
        value: "Which database should we use?",
        kind: "single-select",
        toolCallId: "call-1",
        ts: 1_700_000_000_000,
        ...overrides,
    };
}

describe("RecentQuestionsStore", () => {
    it("starts empty", () => {
        const store = makeRecentQuestionsStore();
        expect(store.size()).toBe(0);
        expect(store.recent()).toEqual([]);
    });

    it("adds and returns entries in newest-first order", () => {
        const store = makeRecentQuestionsStore();
        store.add(entry({ header: "A", toolCallId: "c-1" }));
        store.add(entry({ header: "B", toolCallId: "c-2" }));
        store.add(entry({ header: "C", toolCallId: "c-3" }));
        expect(store.recent().map((e) => e.header)).toEqual(["C", "B", "A"]);
    });

    it("caps the ring at 20 entries", () => {
        const store = makeRecentQuestionsStore();
        for (let i = 0; i < 25; i++) {
            store.add(entry({ header: `H${i}`, toolCallId: `c-${i}` }));
        }
        expect(store.size()).toBe(20);
        // Newest survives; oldest is evicted.
        expect(store.recent()[0].header).toBe("H24");
        expect(store.recent()[19].header).toBe("H5");
    });

    it("replaces an entry when the same toolCallId is re-added", () => {
        const store = makeRecentQuestionsStore();
        store.add(entry({ header: "Draft", toolCallId: "dup", ts: 1 }));
        store.add(entry({ header: "Final", toolCallId: "dup", ts: 2 }));
        expect(store.size()).toBe(1);
        expect(store.recent()[0].header).toBe("Final");
    });

    it("clears the store", () => {
        const store = makeRecentQuestionsStore();
        store.add(entry());
        store.add(entry({ header: "Other", toolCallId: "c-2" }));
        store.clear();
        expect(store.size()).toBe(0);
        expect(store.recent()).toEqual([]);
    });
});

describe("entriesFromAskUserCall", () => {
    it("emits one entry for single-select with the top-level question", () => {
        const out = entriesFromAskUserCall(
            { question: "Which database?" },
            "single-select",
            "c-1",
        );
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({
            header: "Which database?",
            value: "Which database?",
            kind: "single-select",
            toolCallId: "c-1",
        });
    });

    it("emits one entry per questionnaire sub-question", () => {
        const out = entriesFromAskUserCall(
            {
                question: "Project setup",
                questions: [
                    { title: "Database" },
                    { title: "Architecture" },
                    { title: "Notes" },
                ],
            },
            "questionnaire",
            "c-2",
        );
        expect(out.map((e) => e.header)).toEqual(["Database", "Architecture", "Notes"]);
        expect(out.every((e) => e.kind === "questionnaire")).toBe(true);
    });

    it("skips questionnaire sub-questions with empty titles", () => {
        const out = entriesFromAskUserCall(
            {
                question: "Project setup",
                questions: [
                    { title: "Database" },
                    { title: "" },
                    { title: "  " },
                ],
            },
            "questionnaire",
            "c-3",
        );
        expect(out.map((e) => e.header)).toEqual(["Database"]);
    });

    it("returns [] when both question and questions are missing", () => {
        expect(entriesFromAskUserCall({}, "single-select", "c-x")).toEqual([]);
    });
});

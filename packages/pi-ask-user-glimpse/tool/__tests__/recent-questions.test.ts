import { describe, expect, it } from "vitest";
import {
    entriesFromAskUserCall,
    extractAskUserCallsFromJournal,
    inferAskKindFromParams,
    type JournalToolCallEntry,
    makeRecentQuestionsStore,
    type RecentQuestion,
    seedStoreFromJournal,
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

    it("replaces an entry when the same (toolCallId, header) is re-added", () => {
        const store = makeRecentQuestionsStore();
        store.add(entry({ header: "Pick", toolCallId: "dup", ts: 1 }));
        store.add(entry({ header: "Pick", toolCallId: "dup", ts: 2 }));
        expect(store.size()).toBe(1);
        expect(store.recent()[0].ts).toBe(2);
    });

    it("keeps distinct headers even when they share a toolCallId (questionnaire)", () => {
        // Questionnaires emit multiple entries with the same toolCallId but
        // distinct headers (one per sub-question). The store must keep all
        // of them, not collapse them.
        const store = makeRecentQuestionsStore();
        store.add(entry({ header: "Database", toolCallId: "q-1" }));
        store.add(entry({ header: "Architecture", toolCallId: "q-1" }));
        expect(store.size()).toBe(2);
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
        expect(out.map((e) => e.header)).toEqual([
            "Database",
            "Architecture",
            "Notes",
        ]);
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

describe("inferAskKindFromParams", () => {
    it("returns questionnaire when questions[] is present and non-empty", () => {
        expect(inferAskKindFromParams({ questions: [{ title: "A" }] })).toBe(
            "questionnaire",
        );
    });
    it("returns multi-select when allowMultiple is true", () => {
        expect(
            inferAskKindFromParams({ allowMultiple: true, options: ["A"] }),
        ).toBe("multi-select");
    });
    it("returns single-select when options[] is present", () => {
        expect(inferAskKindFromParams({ options: ["A", "B"] })).toBe(
            "single-select",
        );
    });
    it("falls back to freeform", () => {
        expect(inferAskKindFromParams({ question: "Open answer" })).toBe(
            "freeform",
        );
    });
});

describe("extractAskUserCallsFromJournal", () => {
    function assistantWithToolCalls(
        calls: Array<{ id: string; name: string; arguments: unknown }>,
    ): JournalToolCallEntry {
        return {
            type: "message",
            message: {
                role: "assistant",
                content: calls.map((c) => ({ type: "toolCall", ...c })),
            },
        };
    }

    it("returns [] for an empty journal", () => {
        expect(extractAskUserCallsFromJournal([])).toEqual([]);
    });

    it("ignores non-message entries", () => {
        const entries = [
            { type: "compaction", summary: "x" },
            { type: "session_info", name: "foo" },
        ] as unknown as Parameters<typeof extractAskUserCallsFromJournal>[0];
        expect(extractAskUserCallsFromJournal(entries)).toEqual([]);
    });

    it("ignores user/toolResult messages", () => {
        const entries = [
            { type: "message", message: { role: "user", content: "hi" } },
            {
                type: "message",
                message: { role: "toolResult", toolCallId: "x" },
            },
        ] as unknown as Parameters<typeof extractAskUserCallsFromJournal>[0];
        expect(extractAskUserCallsFromJournal(entries)).toEqual([]);
    });

    it("picks ask_user tool calls and skips other tools", () => {
        const entries: JournalToolCallEntry[] = [
            assistantWithToolCalls([
                { id: "bash-1", name: "bash", arguments: { command: "ls" } },
                {
                    id: "ask-1",
                    name: "ask_user",
                    arguments: { question: "Pick a database" },
                },
            ]),
        ];
        const out = extractAskUserCallsFromJournal(entries);
        expect(out).toHaveLength(1);
        expect(out[0]).toEqual({
            toolCallId: "ask-1",
            params: { question: "Pick a database" },
        });
    });

    it("walks multiple ask_user calls across multiple messages", () => {
        const entries: JournalToolCallEntry[] = [
            assistantWithToolCalls([
                {
                    id: "ask-1",
                    name: "ask_user",
                    arguments: { question: "First" },
                },
            ]),
            assistantWithToolCalls([
                {
                    id: "ask-2",
                    name: "ask_user",
                    arguments: {
                        questions: [{ title: "SubA" }, { title: "SubB" }],
                    },
                },
            ]),
        ];
        const out = extractAskUserCallsFromJournal(entries);
        expect(out.map((c) => c.toolCallId)).toEqual(["ask-1", "ask-2"]);
    });

    it("returns args verbatim, even when they are empty", () => {
        const entries: JournalToolCallEntry[] = [
            assistantWithToolCalls([
                { id: "ask-1", name: "ask_user", arguments: {} },
            ]),
        ];
        expect(extractAskUserCallsFromJournal(entries)).toEqual([
            { toolCallId: "ask-1", params: {} },
        ]);
    });
});

describe("seedStoreFromJournal", () => {
    function assistantAsk(
        id: string,
        args: Record<string, unknown>,
    ): JournalToolCallEntry {
        return {
            type: "message",
            message: {
                role: "assistant",
                content: [
                    { type: "toolCall", id, name: "ask_user", arguments: args },
                ],
            },
        };
    }

    it("returns 0 and leaves the store empty for an empty journal", () => {
        const store = makeRecentQuestionsStore();
        expect(seedStoreFromJournal(store, [])).toBe(0);
        expect(store.size()).toBe(0);
    });

    it("seeds one entry per single-select ask_user call", () => {
        const store = makeRecentQuestionsStore();
        const added = seedStoreFromJournal(store, [
            assistantAsk("a-1", {
                question: "Pick a database",
                options: ["postgres", "mysql"],
            }),
            assistantAsk("a-2", {
                question: "Pick a framework",
                options: ["next", "remix"],
            }),
        ]);
        expect(added).toBe(2);
        // Newest first: a-2 should be the freshest.
        expect(store.recent().map((e) => e.header)).toEqual([
            "Pick a framework",
            "Pick a database",
        ]);
        expect(store.recent().every((e) => e.kind === "single-select")).toBe(
            true,
        );
    });

    it("emits one entry per questionnaire sub-question", () => {
        const store = makeRecentQuestionsStore();
        const added = seedStoreFromJournal(store, [
            assistantAsk("q-1", {
                questions: [{ title: "Database" }, { title: "Architecture" }],
            }),
        ]);
        expect(added).toBe(2);
        expect(store.recent().map((e) => e.header)).toEqual([
            "Architecture",
            "Database",
        ]);
    });

    it("infers multi-select from allowMultiple even with options", () => {
        const store = makeRecentQuestionsStore();
        seedStoreFromJournal(store, [
            assistantAsk("m-1", {
                allowMultiple: true,
                options: ["A", "B", "C"],
            }),
        ]);
        expect(store.recent().every((e) => e.kind === "multi-select")).toBe(
            true,
        );
    });

    it("skips ask_user calls with no headable question", () => {
        const store = makeRecentQuestionsStore();
        const added = seedStoreFromJournal(store, [
            assistantAsk("empty-1", {}),
            assistantAsk("ok-1", { question: "Real one" }),
        ]);
        expect(added).toBe(1);
        expect(store.recent().map((e) => e.header)).toEqual(["Real one"]);
    });

    it("skips non-ask_user tool calls and other message types", () => {
        const store = makeRecentQuestionsStore();
        const entries: JournalToolCallEntry[] = [
            {
                type: "message",
                message: {
                    role: "assistant",
                    content: [
                        {
                            type: "toolCall",
                            id: "bash-1",
                            name: "bash",
                            arguments: { command: "ls" },
                        },
                    ],
                },
            },
            assistantAsk("ask-1", { question: "Pick a tool" }),
        ];
        const added = seedStoreFromJournal(store, entries);
        expect(added).toBe(1);
        expect(store.recent()[0].header).toBe("Pick a tool");
    });

    it("preserves real toolCallIds (for dedup against tool_call events)", () => {
        const store = makeRecentQuestionsStore();
        seedStoreFromJournal(store, [
            assistantAsk("real-id-123", { question: "Database" }),
        ]);
        expect(store.recent()[0].toolCallId).toBe("real-id-123");
    });

    it("re-seeding the same journal is idempotent (dedup by toolCallId)", () => {
        const store = makeRecentQuestionsStore();
        const entries = [assistantAsk("dup-1", { question: "Pick a tool" })];
        seedStoreFromJournal(store, entries);
        seedStoreFromJournal(store, entries);
        expect(store.size()).toBe(1);
    });
});

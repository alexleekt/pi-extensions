import type { AutocompleteProvider } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import { makeRecentQuestionAutocompleteProvider } from "../extension-autocomplete.js";
import {
    makeRecentQuestionsStore,
    type RecentQuestion,
} from "../recent-questions.js";

function makeCurrent(): AutocompleteProvider {
    return {
        async getSuggestions() {
            return null;
        },
        applyCompletion(lines) {
            return { lines, cursorLine: 0, cursorCol: 0 };
        },
        shouldTriggerFileCompletion() {
            return true;
        },
    };
}

function seed(headers: string[]): ReturnType<typeof makeRecentQuestionsStore> {
    const store = makeRecentQuestionsStore();
    headers.forEach((h, i) => {
        const entry: RecentQuestion = {
            header: h,
            value: h,
            kind: "single-select",
            toolCallId: `c-${i}`,
            ts: 1_700_000_000_000 + i,
        };
        store.add(entry);
    });
    return store;
}

const noAbort = { aborted: false } as AbortSignal;

describe("makeRecentQuestionAutocompleteProvider", () => {
    it("keeps the provider compatible with Pi's current autocomplete API", () => {
        const provider = makeRecentQuestionAutocompleteProvider(
            makeCurrent(),
            makeRecentQuestionsStore(),
        );
        expect(provider).not.toHaveProperty("triggerCharacters");
        expect(provider.getSuggestions).toEqual(expect.any(Function));
    });

    it("delegates to current when no # token is present", async () => {
        const current = makeCurrent();
        let called = false;
        const currentWithSpy: AutocompleteProvider = {
            ...current,
            async getSuggestions(...args) {
                called = true;
                return current.getSuggestions(...args);
            },
        };
        const provider = makeRecentQuestionAutocompleteProvider(
            currentWithSpy,
            makeRecentQuestionsStore(),
        );
        const result = await provider.getSuggestions(["hello world"], 0, 5, {
            signal: noAbort,
        });
        expect(called).toBe(true);
        expect(result).toBeNull();
    });

    it("returns prefix matches before fuzzy matches when # token is present", async () => {
        const store = seed([
            "Database",
            "Caching",
            "Deployment",
            "Architecture",
        ]);
        const provider = makeRecentQuestionAutocompleteProvider(
            makeCurrent(),
            store,
        );
        const result = await provider.getSuggestions(["#Da"], 0, 3, {
            signal: noAbort,
        });
        expect(result).not.toBeNull();
        expect(result?.prefix).toBe("#Da");
        // "Database" is the only prefix hit.
        expect(result?.items.map((i) => i.value)).toEqual(["Database"]);
    });

    it("falls back to fuzzy filter when no prefix hit exists", async () => {
        const store = seed([
            "Database",
            "Caching",
            "Deployment",
            "Architecture",
        ]);
        const provider = makeRecentQuestionAutocompleteProvider(
            makeCurrent(),
            store,
        );
        const result = await provider.getSuggestions(["#arch"], 0, 5, {
            signal: noAbort,
        });
        expect(result).not.toBeNull();
        // Fuzzy "arch" should hit "Architecture".
        expect(result?.items.some((i) => i.value === "Architecture")).toBe(
            true,
        );
    });

    it("returns all entries in newest-first order when query is empty after #", async () => {
        const store = seed(["A", "B", "C"]);
        const provider = makeRecentQuestionAutocompleteProvider(
            makeCurrent(),
            store,
        );
        const result = await provider.getSuggestions(["#"], 0, 1, {
            signal: noAbort,
        });
        expect(result).not.toBeNull();
        expect(result?.items.map((i) => i.value)).toEqual(["C", "B", "A"]);
        expect(result?.prefix).toBe("#");
    });

    it("delegates to current when the store is empty", async () => {
        const current = makeCurrent();
        let called = false;
        const currentWithSpy: AutocompleteProvider = {
            ...current,
            async getSuggestions(...args) {
                called = true;
                return current.getSuggestions(...args);
            },
        };
        const provider = makeRecentQuestionAutocompleteProvider(
            currentWithSpy,
            makeRecentQuestionsStore(),
        );
        const result = await provider.getSuggestions(["#x"], 0, 2, {
            signal: noAbort,
        });
        expect(called).toBe(true);
        expect(result).toBeNull();
    });

    it("delegates to current when the request is aborted", async () => {
        const current = makeCurrent();
        let called = false;
        const currentWithSpy: AutocompleteProvider = {
            ...current,
            async getSuggestions(...args) {
                called = true;
                return current.getSuggestions(...args);
            },
        };
        const store = seed(["Database"]);
        const provider = makeRecentQuestionAutocompleteProvider(
            currentWithSpy,
            store,
        );
        const result = await provider.getSuggestions(["#D"], 0, 2, {
            signal: { aborted: true } as AbortSignal,
        });
        expect(called).toBe(true);
        expect(result).toBeNull();
    });

    it("caps the suggestion list at MAX_SUGGESTIONS", async () => {
        const store = seed(Array.from({ length: 30 }, (_, i) => `Header ${i}`));
        const provider = makeRecentQuestionAutocompleteProvider(
            makeCurrent(),
            store,
        );
        const result = await provider.getSuggestions(["#"], 0, 1, {
            signal: noAbort,
        });
        expect(result).not.toBeNull();
        expect(result?.items.length).toBeLessThanOrEqual(20);
    });

    it("matches a # token on a non-first line", async () => {
        const store = seed(["Database"]);
        const provider = makeRecentQuestionAutocompleteProvider(
            makeCurrent(),
            store,
        );
        // Multi-line input, cursor on line 1, after "#Da"
        const result = await provider.getSuggestions(
            ["first line of message", "respond to #Da"],
            1,
            // cursorCol is 0-indexed; "respond to #Da" is 15 chars
            "respond to #Da".length,
            { signal: noAbort },
        );
        expect(result).not.toBeNull();
        expect(result?.items.map((i) => i.value)).toEqual(["Database"]);
        expect(result?.prefix).toBe("#Da");
    });

    it("delegates applyCompletion and shouldTriggerFileCompletion to current", () => {
        const calls = { apply: 0, file: 0 };
        const current: AutocompleteProvider = {
            async getSuggestions() {
                return null;
            },
            applyCompletion(lines, line, col) {
                calls.apply++;
                return { lines, cursorLine: line, cursorCol: col + 1 };
            },
            shouldTriggerFileCompletion() {
                calls.file++;
                return false;
            },
        };
        const provider = makeRecentQuestionAutocompleteProvider(
            current,
            makeRecentQuestionsStore(),
        );

        const applyCompletion = provider.applyCompletion;
        expect(applyCompletion).toEqual(expect.any(Function));
        const applied = applyCompletion(
            ["a"],
            0,
            1,
            { value: "X", label: "X" },
            "#X",
        );
        // `#X` not found in the line `"a"` — falls back to current
        expect(applied.cursorCol).toBe(2);
        expect(calls.apply).toBe(1);

        const shouldTriggerFileCompletion =
            provider.shouldTriggerFileCompletion;
        expect(shouldTriggerFileCompletion).toEqual(expect.any(Function));
        if (!shouldTriggerFileCompletion) {
            throw new Error("shouldTriggerFileCompletion missing");
        }
        const triggered = shouldTriggerFileCompletion(["a"], 0, 1);
        expect(triggered).toBe(false);
        expect(calls.file).toBe(1);
    });

    it("replaces #prefix with selected value in applyCompletion", () => {
        const current = makeCurrent();
        const store = seed(["Which database should we use?"]);
        const provider = makeRecentQuestionAutocompleteProvider(
            current,
            store,
        );

        // Simulate user typing "#Da" and selecting "Which database should we use?"
        // cursorCol is right after "#Da" in "tell me about #Da and more"
        const input = "tell me about #Da and more";
        const cursorAt = input.indexOf("#Da") + "#Da".length;  // 18
        const lines = [input];
        const result = provider.applyCompletion(
            lines,
            0,
            cursorAt,
            { value: "Which database should we use?", label: "#Which database should we use?" },
            "#Da",
        );

        const expectedLine = "tell me about Which database should we use? and more";
        expect(result.lines).toEqual([expectedLine]);
        // Cursor should be right after the inserted value, not at end of line
        expect(result.cursorCol).toBe(14 + "Which database should we use?".length);
        expect(result.cursorLine).toBe(0);
    });

    it("replaces # prefix at start of line", () => {
        const current = makeCurrent();
        const store = seed(["Database"]);
        const provider = makeRecentQuestionAutocompleteProvider(
            current,
            store,
        );

        const lines = ["#Database rest of message"];
        const result = provider.applyCompletion(
            lines,
            0,
            9,  // cursor at end of "#Database"
            { value: "Database", label: "#Database" },
            "#Database",
        );

        expect(result.lines).toEqual(["Database rest of message"]);
        expect(result.cursorCol).toBe("Database".length);
    });

    it("falls back to current provider when prefix does not start with #", () => {
        let callbackCount = 0;
        const current: AutocompleteProvider = {
            async getSuggestions() {
                return null;
            },
            applyCompletion(lines, line, col) {
                callbackCount++;
                return { lines, cursorLine: line, cursorCol: col + 10 };
            },
            shouldTriggerFileCompletion() {
                return true;
            },
        };
        const provider = makeRecentQuestionAutocompleteProvider(
            current,
            makeRecentQuestionsStore(),
        );

        // Non-# prefix should delegate to current
        const lines = ["/command foo"];
        const result = provider.applyCompletion(
            lines,
            0,
            8,
            { value: "/command expanded", label: "/command" },
            "/command",
        );

        expect(callbackCount).toBe(1);
        expect(result.cursorCol).toBe(18); // col + 10 from mock
    });
});

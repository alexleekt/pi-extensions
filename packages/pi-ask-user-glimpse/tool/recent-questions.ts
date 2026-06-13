/**
 * Recent ask_user calls — small in-memory ring buffer used to power
 * the `#<header>` autocomplete in the extension's `addAutocompleteProvider` factory.
 *
 * The store is intentionally session-scoped (no disk persistence): session_start
 * clears it, every ask_user tool_call seeds it, the autocomplete reads from it.
 */

const MAX_ENTRIES = 20;

export type AskKind =
    | "single-select"
    | "multi-select"
    | "freeform"
    | "questionnaire";

export interface RecentQuestion {
    /** Short label shown in the autocomplete dropdown (the "header"). */
    header: string;
    /** Full text inserted when the user picks this entry. */
    value: string;
    /** kind + summary for the description line in the dropdown. */
    kind: AskKind;
    /** tool_call id this entry came from; used to dedupe replays. */
    toolCallId: string;
    /** When this entry was added (ms since epoch). */
    ts: number;
}

export class RecentQuestionsStore {
    private entries: RecentQuestion[] = [];

    add(entry: RecentQuestion): void {
        // Dedup on (toolCallId, header) — not just toolCallId — so that
        // questionnaire sub-questions (which share one toolCallId but have
        // distinct titles) all survive a single `add` batch. Same header +
        // same toolCallId still dedupes, which is the retry case the original
        // design was guarding against.
        this.entries = this.entries.filter(
            (e) =>
                !(
                    e.toolCallId === entry.toolCallId &&
                    e.header === entry.header
                ),
        );
        this.entries.push(entry);
        if (this.entries.length > MAX_ENTRIES) {
            this.entries = this.entries.slice(-MAX_ENTRIES);
        }
    }

    recent(): RecentQuestion[] {
        // Newest first — most recent ask_user is the most useful to recall.
        return [...this.entries].reverse();
    }

    clear(): void {
        this.entries = [];
    }

    size(): number {
        return this.entries.length;
    }
}

export function makeRecentQuestionsStore(): RecentQuestionsStore {
    return new RecentQuestionsStore();
}

/**
 * Extract one-or-more "headable" questions from a raw ask_user call.
 * - single/multi/freeform: one entry with the top-level `question`
 * - questionnaire: one entry per `questions[i].title`
 */
export function entriesFromAskUserCall(
    params: { question?: string; questions?: Array<{ title?: string }> },
    kind: AskKind,
    toolCallId: string,
): RecentQuestion[] {
    const ts = Date.now();
    if (
        kind === "questionnaire" &&
        Array.isArray(params.questions) &&
        params.questions.length > 0
    ) {
        return params.questions
            .map((q) => (q.title || "").trim())
            .filter((title) => title.length > 0)
            .map<RecentQuestion>((title) => ({
                header: title,
                value: title,
                kind,
                toolCallId,
                ts,
            }));
    }
    const top = (params.question || "").trim();
    if (!top) return [];
    return [
        {
            header: top,
            value: top,
            kind,
            toolCallId,
            ts,
        },
    ];
}

/**
 * Minimal subset of pi-coding-agent session/journal entries that we need
 * to walk for the `#<header>` autocomplete re-seed on `session_start`.
 *
 * Defined here as a structural type so the function is testable in isolation
 * (the real `SessionEntry` union is large and changes between pi versions).
 */
export interface JournalToolCallEntry {
    type: "message";
    message: {
        role: "assistant";
        content: Array<
            | { type: "text"; text: string }
            | { type: "thinking"; text: string }
            | { type: "toolCall"; id: string; name: string; arguments: unknown }
        >;
        timestamp?: number;
    };
}

/** Walk session entries and pull out every `ask_user` tool call's params + id. */
export function extractAskUserCallsFromJournal(
    entries: ReadonlyArray<JournalToolCallEntry>,
): Array<{ toolCallId: string; params: AskUserParamsFromJournal }> {
    const results: Array<{
        toolCallId: string;
        params: AskUserParamsFromJournal;
    }> = [];
    for (const entry of entries) {
        if (entry.type !== "message") continue;
        if (entry.message.role !== "assistant") continue;
        for (const block of entry.message.content) {
            if (block.type !== "toolCall") continue;
            if (block.name !== "ask_user") continue;
            results.push({
                toolCallId: block.id,
                params: (block.arguments ?? {}) as AskUserParamsFromJournal,
            });
        }
    }
    return results;
}

/**
 * Subset of AskUserParams we actually consume when re-seeding from the journal.
 * Cast at the boundary so we don't depend on the full extension type here.
 */
export type AskUserParamsFromJournal = {
    question?: string;
    questions?: Array<{ title?: string }>;
    options?: Array<unknown>;
    allowMultiple?: boolean;
};

/**
 * Infer the AskKind from raw params (mirrors `inferAskKind` in index.ts but
 * lives here so the journal-walking helper is self-contained and testable).
 */
export function inferAskKindFromParams(
    params: AskUserParamsFromJournal,
): AskKind {
    if (Array.isArray(params.questions) && params.questions.length > 0) {
        return "questionnaire";
    }
    if (params.allowMultiple) {
        return "multi-select";
    }
    if (Array.isArray(params.options) && params.options.length > 0) {
        return "single-select";
    }
    return "freeform";
}

/**
 * Re-seed a `RecentQuestionsStore` from past `ask_user` tool calls recorded
 * in the session journal. Used by `session_start` to populate the `#<header>`
 * autocomplete after a session is resumed or the extension is reloaded.
 *
 * - Iterates entries newest-first so the most recent question is the
 *   "freshest" entry in the store. (`add()` dedupes by toolCallId.)
 * - Returns the number of new entries added (skips calls that produced
 *   no headable question).
 */
export function seedStoreFromJournal(
    store: RecentQuestionsStore,
    entries: ReadonlyArray<JournalToolCallEntry>,
): number {
    const calls = extractAskUserCallsFromJournal(entries);
    // The journal lists tool calls oldest-first; the store keeps `entries` in
    // insertion order and `recent()` reverses for display. So inserting in
    // journal order is what makes the newest call surface at the top of the
    // dropdown — do NOT reverse here.
    let added = 0;
    for (const { params, toolCallId } of calls) {
        const kind = inferAskKindFromParams(params);
        const newEntries = entriesFromAskUserCall(params, kind, toolCallId);
        if (newEntries.length === 0) continue;
        for (const e of newEntries) {
            store.add(e);
        }
        added += newEntries.length;
    }
    return added;
}

/**
 * Recent ask_user calls — small in-memory ring buffer used to power
 * the `#<header>` autocomplete in the extension's `addAutocompleteProvider` factory.
 *
 * The store is intentionally session-scoped (no disk persistence): session_start
 * clears it, every ask_user tool_call seeds it, the autocomplete reads from it.
 */

const MAX_ENTRIES = 20;

export type AskKind = "single-select" | "multi-select" | "freeform" | "questionnaire";

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
        // Replace any existing entry from the same tool_call (handles retries).
        this.entries = this.entries.filter((e) => e.toolCallId !== entry.toolCallId);
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
    if (kind === "questionnaire" && Array.isArray(params.questions) && params.questions.length > 0) {
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

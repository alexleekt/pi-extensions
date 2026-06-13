/**
 * Extension autocomplete — factory that stacks on top of Pi's built-in
 * slash / path provider, adding:
 *
 *   `#<header>` → fuzzy-completed reference to a recent ask_user call
 *                 (single-select / multi-select / freeform / questionnaire)
 *
 * Design mirrors `examples/extensions/github-issue-autocomplete.ts` from
 * @earendil-works/pi-coding-agent: decorate the current provider, intercept
 * only the prefixes we own, and delegate everything else to `current`.
 *
 * Pi's current `AutocompleteProvider` API has no trigger-character field, so
 * this provider detects `#<query>` inside `getSuggestions` and delegates every
 * non-matching cursor position to the wrapped provider.
 */

import type {
    AutocompleteItem,
    AutocompleteProvider,
} from "@earendil-works/pi-tui";
import { fuzzyFilter } from "@earendil-works/pi-tui";
import type { RecentQuestionsStore } from "./recent-questions.js";

const MAX_SUGGESTIONS = 20;

/** Match `#<query>` at token boundaries — start of line or after whitespace. */
const HEADER_REGEX = /(?:^|[ \t])#([^\s#]*)$/;

export function makeRecentQuestionAutocompleteProvider(
    current: AutocompleteProvider,
    store: RecentQuestionsStore,
): AutocompleteProvider {
    return {
        async getSuggestions(lines, cursorLine, cursorCol, options) {
            const currentLine = lines[cursorLine] ?? "";
            const beforeCursor = currentLine.slice(0, cursorCol);
            const match = beforeCursor.match(HEADER_REGEX);
            if (!match) {
                return current.getSuggestions(
                    lines,
                    cursorLine,
                    cursorCol,
                    options,
                );
            }

            const query = match[1] ?? "";
            const entries = store.recent();
            if (options.signal.aborted || entries.length === 0) {
                return current.getSuggestions(
                    lines,
                    cursorLine,
                    cursorCol,
                    options,
                );
            }

            const ranked = rankEntries(entries, query);
            if (ranked.length === 0) {
                return current.getSuggestions(
                    lines,
                    cursorLine,
                    cursorCol,
                    options,
                );
            }

            const items: AutocompleteItem[] = ranked
                .slice(0, MAX_SUGGESTIONS)
                .map((entry) => ({
                    value: entry.value,
                    label: `#${entry.header}`,
                    description: describeEntry(entry, query.length === 0),
                }));

            return {
                items,
                prefix: `#${query}`,
            };
        },

        applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
            return current.applyCompletion(
                lines,
                cursorLine,
                cursorCol,
                item,
                prefix,
            );
        },

        shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
            return (
                current.shouldTriggerFileCompletion?.(
                    lines,
                    cursorLine,
                    cursorCol,
                ) ?? true
            );
        },
    };
}

/** Pure ranking: prefix hits first, then fuzzy matches. Stable on insertion order. */
function rankEntries(
    entries: ReturnType<RecentQuestionsStore["recent"]>,
    query: string,
) {
    const q = query.toLowerCase();
    if (q.length === 0) {
        return entries;
    }
    const prefixHits = entries.filter((e) =>
        e.header.toLowerCase().startsWith(q),
    );
    if (prefixHits.length > 0) {
        return prefixHits;
    }
    return fuzzyFilter(entries, query, (e) => e.header);
}

function describeEntry(
    entry: ReturnType<RecentQuestionsStore["recent"]>[number],
    isEmptyQuery: boolean,
): string {
    const parts: string[] = [entry.kind];
    if (entry.header.length > 60 && !isEmptyQuery) {
        // Avoid duplicating the header in the description when the label is already long.
        return parts.join(" · ");
    }
    // Truncate the value to keep the dropdown narrow.
    const value =
        entry.value.length > 80 ? `${entry.value.slice(0, 77)}…` : entry.value;
    parts.push(value);
    return parts.join(" · ");
}

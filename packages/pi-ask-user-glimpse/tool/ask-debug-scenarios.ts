import type { AutocompleteItem } from "@earendil-works/pi-tui";

/**
 * Fixed debug scenarios exposed by the `/ask-debug` command and surfaced
 * as Tab-completions in Pi's editor. Mirrors the `buildDebugParams()` switch
 * in `index.ts` — keep in sync when adding new scenarios.
 */
export const ASK_DEBUG_SCENARIOS: AutocompleteItem[] = [
    {
        value: "single-select",
        label: "single-select",
        description: "Radio-style options with optional freeform + comment",
    },
    {
        value: "multi-select",
        label: "multi-select",
        description: "Checkbox-style options, select-all, submit-gating",
    },
    {
        value: "freeform",
        label: "freeform",
        description: "Plain textarea, character counter, platform shortcuts",
    },
    {
        value: "questionnaire",
        label: "questionnaire",
        description:
            "Multiple structured questions, progress bar, per-Q counters",
    },
    {
        value: "kitchen-sink",
        label: "kitchen-sink",
        description: "Every feature: HTML context, charts, comparison tables",
    },
];

/**
 * Filter scenarios for the typed prefix. Returns the full list when the
 * prefix is empty (so Tab right after `/ask-debug ` shows all options).
 * Case-insensitive match against the `value` (insertion text).
 */
export function filterAskDebugScenarios(prefix: string): AutocompleteItem[] {
    const p = prefix.trim().toLowerCase();
    if (!p) return [...ASK_DEBUG_SCENARIOS];
    return ASK_DEBUG_SCENARIOS.filter((s) =>
        s.value.toLowerCase().startsWith(p),
    );
}

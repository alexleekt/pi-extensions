import { describe, expect, it } from "vitest";
import {
    ASK_DEBUG_SCENARIOS,
    filterAskDebugScenarios,
} from "../ask-debug-scenarios.js";

describe("ASK_DEBUG_SCENARIOS", () => {
    it("has 5 scenarios matching the /ask-debug select dialog options", () => {
        // The select dialog fallback in the ask-debug handler uses these values.
        // If you add or remove a scenario, update both this list and buildDebugParams().
        expect(ASK_DEBUG_SCENARIOS.map((s) => s.value)).toEqual([
            "single-select",
            "multi-select",
            "freeform",
            "questionnaire",
            "kitchen-sink",
        ]);
    });

    it("gives every scenario a value, label, and description", () => {
        for (const s of ASK_DEBUG_SCENARIOS) {
            expect(s.value, `value missing for ${s.label}`).toBeTruthy();
            expect(s.label, `label missing for ${s.value}`).toBeTruthy();
            expect(s.description, `description missing for ${s.value}`).toBeTruthy();
        }
    });
});

describe("filterAskDebugScenarios", () => {
    it("returns the full list when prefix is empty", () => {
        expect(filterAskDebugScenarios("")).toEqual(ASK_DEBUG_SCENARIOS);
    });

    it("returns the full list when prefix is whitespace only", () => {
        expect(filterAskDebugScenarios("   ")).toEqual(ASK_DEBUG_SCENARIOS);
    });

    it("returns a copy, not the original array, when prefix is empty", () => {
        // Defensive: callers must be able to mutate the result without affecting
        // the module-level constant.
        const result = filterAskDebugScenarios("");
        expect(result).not.toBe(ASK_DEBUG_SCENARIOS);
        result.pop();
        expect(ASK_DEBUG_SCENARIOS).toHaveLength(5);
    });

    it("filters by value prefix (case-insensitive)", () => {
        expect(filterAskDebugScenarios("kit").map((s) => s.value)).toEqual([
            "kitchen-sink",
        ]);
        expect(filterAskDebugScenarios("KIT").map((s) => s.value)).toEqual([
            "kitchen-sink",
        ]);
        expect(filterAskDebugScenarios("multi").map((s) => s.value)).toEqual([
            "multi-select",
        ]);
    });

    it("trims surrounding whitespace from the prefix", () => {
        expect(filterAskDebugScenarios("  free  ").map((s) => s.value)).toEqual(
            ["freeform"],
        );
    });

    it("returns an empty array when no scenario matches", () => {
        expect(filterAskDebugScenarios("zzzz")).toEqual([]);
        expect(filterAskDebugScenarios("xyz")).toEqual([]);
    });
});

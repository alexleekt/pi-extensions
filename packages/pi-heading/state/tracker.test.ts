// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { describe, expect, test } from "bun:test";
import { HeadingStalenessTracker } from "./tracker.js";

describe("HeadingStalenessTracker", () => {
    test("isStale returns false when below threshold", () => {
        const tracker = new HeadingStalenessTracker();
        // First call establishes baseline (turnsSinceUpdate = 0)
        tracker.onTurnEnd("Fixing the bug");
        // Second call with same goal: turnsSinceUpdate = 1
        tracker.onTurnEnd("Fixing the bug");
        expect(tracker.isStale(5)).toBe(false);
        expect(tracker.getTurnsSinceUpdate()).toBe(1);
    });

    test("isStale returns true after threshold is exceeded", () => {
        const tracker = new HeadingStalenessTracker();
        // 1: baseline, 2-7: 6 consecutive same-goal turns = turnsSinceUpdate = 6
        for (let i = 0; i < 7; i++) {
            tracker.onTurnEnd("Fixing the bug");
        }
        expect(tracker.isStale(5)).toBe(true);
        expect(tracker.getTurnsSinceUpdate()).toBe(6);
    });

    test("onTurnEnd resets counter when goal changes", () => {
        const tracker = new HeadingStalenessTracker();
        tracker.onTurnEnd("Fixing the bug"); // baseline: 0
        tracker.onTurnEnd("Fixing the bug"); // 1
        tracker.onTurnEnd("Fixing the bug"); // 2
        expect(tracker.getTurnsSinceUpdate()).toBe(2);
        tracker.onTurnEnd("Refactoring the API"); // reset: 0
        expect(tracker.getTurnsSinceUpdate()).toBe(0);
        expect(tracker.isStale(5)).toBe(false);
    });

    test("onTurnEnd handles undefined goal", () => {
        const tracker = new HeadingStalenessTracker();
        tracker.onTurnEnd("Fixing the bug"); // baseline: 0
        tracker.onTurnEnd(undefined); // reset to 0 (new goal)
        tracker.onTurnEnd(undefined); // 1
        expect(tracker.getTurnsSinceUpdate()).toBe(1);
    });

    test("reset clears counter and last goal", () => {
        const tracker = new HeadingStalenessTracker();
        tracker.onTurnEnd("Fixing the bug"); // 0
        tracker.onTurnEnd("Fixing the bug"); // 1
        tracker.onTurnEnd("Fixing the bug"); // 2
        tracker.reset();
        expect(tracker.getTurnsSinceUpdate()).toBe(0);
        expect(tracker.isStale(5)).toBe(false);
    });

    test("threshold is configurable", () => {
        const tracker = new HeadingStalenessTracker();
        tracker.onTurnEnd("A"); // 0
        tracker.onTurnEnd("A"); // 1
        tracker.onTurnEnd("A"); // 2
        tracker.onTurnEnd("A"); // 3
        tracker.onTurnEnd("A"); // 4
        expect(tracker.isStale(3)).toBe(true);
    });
});

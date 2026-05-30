// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

/**
 * Heading staleness tracker.
 *
 * Counts how many consecutive turns the heading has remained unchanged.
 * A high count may indicate the heading has drifted from the actual topic.
 */

export class HeadingStalenessTracker {
    private turnsSinceUpdate = 0;
    private lastGoal: string | undefined;

    /** Call at the end of every turn with the current heading goal. */
    onTurnEnd(goal: string | undefined): void {
        if (goal !== this.lastGoal) {
            this.turnsSinceUpdate = 0;
            this.lastGoal = goal;
        } else {
            this.turnsSinceUpdate++;
        }
    }

    /** Reset the counter (e.g. on manual heading update or session start). */
    reset(): void {
        this.turnsSinceUpdate = 0;
        this.lastGoal = undefined;
    }

    /** Number of turns since the heading was last updated. */
    getTurnsSinceUpdate(): number {
        return this.turnsSinceUpdate;
    }

    /** Returns true if the heading has been unchanged for more than the threshold. */
    isStale(threshold: number = 5): boolean {
        return this.turnsSinceUpdate > threshold;
    }
}

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type {
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";

export interface State {
    topic: string;
    goal: string;
    /** Post-turn achievement summary — what the agent accomplished in its last turn. */
    achievement?: string;
}

const STATE_KEY = "heading";

/** In-memory store keyed by branch leaf ID. */
const memory = new Map<string, State>();

export function getState(leafId: string): State | undefined {
    return memory.get(leafId);
}

export function setState(leafId: string, state: State): void {
    memory.set(leafId, state);
}

/** Replay previous recap entries for the current branch. */
export function replayBranch(ctx: ExtensionContext): State | undefined {
    const branch = ctx.sessionManager.getBranch();
    if (!branch?.length) return;

    const leafId = ctx.sessionManager.getLeafId();
    if (!leafId) return;

    for (let i = branch.length - 1; i >= 0; i--) {
        const entry = branch[i];
        if (entry?.type === "custom" && entry?.customType === STATE_KEY) {
            const payload =
                (entry as { data?: unknown; detail?: unknown }).data ??
                (entry as { data?: unknown; detail?: unknown }).detail;
            const p = payload as Record<string, unknown> | undefined;
            if (
                p &&
                typeof p.topic === "string" &&
                typeof p.goal === "string"
            ) {
                const state: State = {
                    topic: p.topic,
                    goal: p.goal,
                    achievement: p.achievement as string | undefined,
                };
                memory.set(leafId, state);
                return state;
            }
        }
    }
}

/** Persist a new recap entry to the branch. */
export function persistState(pi: ExtensionAPI, state: State): void {
    pi.appendEntry(STATE_KEY, state);
}

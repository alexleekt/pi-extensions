// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type {
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { HeadingExposure, State, WidgetMode } from "../types.js";

const STATE_KEY = "heading";

/** In-memory store keyed by branch leaf ID. */
const memory = new Map<string, State>();

export function getState(leafId: string): State | undefined {
    return memory.get(leafId);
}

export function setState(leafId: string, state: State): void {
    memory.set(leafId, state);
}

/** Clear all in-memory state (useful for testing). */
export function clearState(): void {
    memory.clear();
}

/** Broadcast heading state to the shared event bus so other extensions can react. */
export function exposeHeading(
    pi: ExtensionAPI,
    state: State,
    mode: WidgetMode,
): void {
    pi.events.emit("heading:state", {
        topic: state.topic,
        goal: state.goal,
        achievement: state.achievement,
        mode,
    } satisfies HeadingExposure);
}

/** Clear exposure when the session ends or no state is available. */
export function clearExposure(pi: ExtensionAPI): void {
    pi.events.emit("heading:state", {
        topic: "",
        goal: "",
        mode: "idle",
    } satisfies HeadingExposure);
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
                typeof entry === "object" && entry !== null
                    ? ((entry as unknown as Record<string, unknown>).data ??
                      (entry as unknown as Record<string, unknown>).detail)
                    : undefined;
            const p = payload as Record<string, unknown> | undefined;
            if (
                p &&
                typeof p.topic === "string" &&
                typeof p.goal === "string"
            ) {
                const state: State = {
                    topic: p.topic,
                    goal: p.goal,
                    achievement:
                        typeof p.achievement === "string"
                            ? p.achievement
                            : undefined,
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

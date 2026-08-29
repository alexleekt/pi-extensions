// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type {
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { HeadingExposure, State, WidgetMode } from "../types.js";

const STATE_KEY = "heading";

/** In-memory state keyed by stable session ID. */
const memory = new Map<string, State>();

export function getState(sessionId: string): State | undefined {
    return memory.get(sessionId);
}

export function setState(sessionId: string, state: State): void {
    memory.set(sessionId, state);
}

/** Clear all in-memory state (used on session and tree boundaries). */
export function clearState(): void {
    memory.clear();
}

function stateFromEntry(entry: unknown): State | undefined {
    if (!entry || typeof entry !== "object") return;
    const record = entry as Record<string, unknown>;
    if (record.type !== "custom" || record.customType !== STATE_KEY) return;

    const payload = (record.data ?? record.detail) as
        | Record<string, unknown>
        | undefined;
    if (
        !payload ||
        typeof payload.topic !== "string" ||
        typeof payload.goal !== "string"
    )
        return;

    return {
        topic: payload.topic,
        goal: payload.goal,
        achievement:
            typeof payload.achievement === "string"
                ? payload.achievement
                : undefined,
        priorOutcome:
            typeof payload.priorOutcome === "string"
                ? payload.priorOutcome
                : undefined,
        priorAge:
            typeof payload.priorAge === "number" ? payload.priorAge : undefined,
    };
}

/** Resolve the newest transient or persisted heading on the active branch. */
export function getBranchState(ctx: ExtensionContext): State | undefined {
    const sessionId = ctx.sessionManager.getSessionId();
    if (sessionId) {
        const sessionState = memory.get(sessionId);
        if (sessionState) return sessionState;
    }

    const branch = ctx.sessionManager.getBranch();
    for (let i = branch.length - 1; i >= 0; i--) {
        const entry = branch[i];
        if (!entry) continue;

        const transient = memory.get(entry.id);
        if (transient) return transient;

        const persisted = stateFromEntry(entry);
        if (persisted) return persisted;
    }
}

let lastEmitted: HeadingExposure | undefined;

/** Broadcast heading state to the shared event bus so other extensions can react.
 *  Skips duplicate emissions to reduce event-bus noise during multi-turn chains. */
export function exposeHeading(
    pi: ExtensionAPI,
    state: State,
    mode: WidgetMode,
): void {
    const payload: HeadingExposure = {
        topic: state.topic,
        goal: state.goal,
        achievement: state.achievement,
        mode,
    };
    if (
        lastEmitted &&
        lastEmitted.topic === payload.topic &&
        lastEmitted.goal === payload.goal &&
        lastEmitted.achievement === payload.achievement &&
        lastEmitted.mode === payload.mode
    ) {
        return;
    }
    lastEmitted = payload;
    pi.events.emit("heading:state", payload);
}

/** Clear exposure when the session ends or no state is available. */
export function clearExposure(pi: ExtensionAPI): void {
    pi.events.emit("heading:state", {
        topic: "",
        goal: "",
        mode: "idle",
    } satisfies HeadingExposure);
    lastEmitted = undefined;
}

/** Persist a new heading entry to the branch. */
export function persistState(pi: ExtensionAPI, state: State): void {
    pi.appendEntry(STATE_KEY, state);
}

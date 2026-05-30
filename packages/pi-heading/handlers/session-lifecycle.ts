// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type {
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { clearExposure, deleteState, exposeHeading, replayBranch } from "../state/store.js";
import { clearHeading, setHeadingMessage } from "../ui/indicator.js";

export interface SharedState {
    turnGeneration: number;
    agentStartedForCurrentTurn: boolean;
    agentEndGeneration: number;
    currentPlaceholder: string | undefined;
    lastExposed?: {
        topic: string;
        goal: string;
        achievement?: string;
        mode: string;
    };
}

export function handleSessionStart(
    _event: unknown,
    ctx: ExtensionContext,
    pi: ExtensionAPI,
    sharedState: SharedState,
): void {
    if (!ctx.hasUI) return;
    sharedState.turnGeneration = 0;
    sharedState.agentStartedForCurrentTurn = false;
    sharedState.agentEndGeneration = 0;
    sharedState.currentPlaceholder = undefined;
    sharedState.lastExposed = undefined;
    const leafId = ctx.sessionManager.getLeafId();
    const replayed = replayBranch(ctx);
    if (replayed?.goal) {
        const mode = replayed.achievement ? "achievement" : "goal";
        setHeadingMessage(ctx, replayed.goal, mode);
        exposeHeading(pi, replayed, mode);
    } else {
        clearHeading(ctx);
        clearExposure(pi);
        if (leafId) deleteState(leafId);
    }
}

export function handleSessionShutdown(
    _event: unknown,
    ctx: ExtensionContext,
    pi: ExtensionAPI,
): void {
    if (!ctx.hasUI) return;
    clearHeading(ctx);
    clearExposure(pi);
}

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type {
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
    clearExposure,
    clearState,
    exposeHeading,
    getBranchState,
} from "../state/store.js";
import type { HeadingStalenessTracker } from "../state/tracker.js";
import { clearHeading, setHeadingMessage } from "../ui/indicator.js";

export interface SharedState {
    turnGeneration: number;
    displayGeneration: number;
    agentStartedForCurrentTurn: boolean;
    agentSettledGeneration: number;
    currentPlaceholder: string | undefined;
    lastExposed?: {
        topic: string;
        goal: string;
        achievement?: string;
        mode: string;
    };
    staleLogged: boolean;
    stalenessTracker: HeadingStalenessTracker;
}

function resetRuntimeState(sharedState: SharedState): void {
    sharedState.turnGeneration++;
    sharedState.displayGeneration++;
    sharedState.agentStartedForCurrentTurn = false;
    sharedState.agentSettledGeneration++;
    sharedState.currentPlaceholder = undefined;
    sharedState.lastExposed = undefined;
    sharedState.staleLogged = false;
    sharedState.stalenessTracker.reset();
}

function restoreBranch(
    ctx: ExtensionContext,
    pi: ExtensionAPI,
    sharedState: SharedState,
): void {
    resetRuntimeState(sharedState);
    clearState();

    const replayed = getBranchState(ctx);
    if (replayed?.goal) {
        const mode = replayed.achievement ? "achievement" : "goal";
        setHeadingMessage(ctx, replayed.achievement ?? replayed.goal, mode);
        exposeHeading(pi, replayed, mode);
    } else {
        clearHeading(ctx);
        clearExposure(pi);
    }
}

export function handleSessionStart(
    _event: unknown,
    ctx: ExtensionContext,
    pi: ExtensionAPI,
    sharedState: SharedState,
): void {
    if (!ctx.hasUI) return;
    restoreBranch(ctx, pi, sharedState);
}

export const handleSessionTree = handleSessionStart;

export function handleSessionShutdown(
    _event: unknown,
    ctx: ExtensionContext,
    pi: ExtensionAPI,
    sharedState: SharedState,
): void {
    resetRuntimeState(sharedState);
    clearState();
    clearExposure(pi);
    if (ctx.hasUI) clearHeading(ctx);
}

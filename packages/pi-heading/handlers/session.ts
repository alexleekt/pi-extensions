// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type {
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { clearExposure, exposeHeading, replayBranch } from "../state/store.js";
import { clearHeading, setHeadingMessage } from "../ui/widget.js";

export interface SharedState {
    turnGeneration: number;
    agentStartedForCurrentTurn: boolean;
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
    const replayed = replayBranch(ctx);
    if (replayed?.goal) {
        const mode = replayed.achievement ? "achievement" : "goal";
        setHeadingMessage(ctx, replayed.goal, mode);
        exposeHeading(pi, replayed, mode);
    } else {
        clearHeading(ctx);
        clearExposure(pi);
    }
}

export function handleSessionShutdown(
    _event: unknown,
    ctx: ExtensionContext,
    pi: ExtensionAPI,
): void {
    if (!ctx.hasUI) return;
    clearHeading(ctx);
    ctx.ui.setWorkingVisible(true); // restore default for next session
    clearExposure(pi);
}

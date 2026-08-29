// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type {
    ExtensionAPI,
    ExtensionContext,
    TurnEndEvent,
} from "@earendil-works/pi-coding-agent";
import { summarizeAchievement } from "../llm/summarize.js";
import { logDebug } from "../state/debug.js";
import {
    exposeHeading,
    getBranchState,
    persistState,
    setState,
} from "../state/store.js";
import { setHeadingMessage } from "../ui/indicator.js";
import {
    extractAgentText,
    makeDebugEntryAchievement,
    makeDebugEntryError,
} from "./debug.js";
import type { SharedState } from "./session-lifecycle.js";

export function handleTurnStart(
    _event: unknown,
    ctx: ExtensionContext,
    pi: ExtensionAPI,
    sharedState: SharedState,
): void {
    if (!ctx.hasUI) return;

    const state = getBranchState(ctx);
    // If a placeholder from the current turn is active, don't overwrite it
    // with stale state from a previous turn.
    if (sharedState.currentPlaceholder) {
        setHeadingMessage(ctx, sharedState.currentPlaceholder, "working");
    } else if (state?.goal) {
        setHeadingMessage(ctx, state.goal, "working");
        // De-duplicate event bus emissions — only emit if state changed.
        const last = sharedState.lastExposed;
        if (
            !last ||
            last.topic !== state.topic ||
            last.goal !== state.goal ||
            last.achievement !== state.achievement ||
            last.mode !== "working"
        ) {
            exposeHeading(pi, state, "working");
            sharedState.lastExposed = {
                topic: state.topic,
                goal: state.goal,
                achievement: state.achievement,
                mode: "working",
            };
        }
    }

    // Staleness warning: log once when heading hasn't changed for many turns.
    if (sharedState.stalenessTracker.isStale(5) && !sharedState.staleLogged) {
        sharedState.staleLogged = true;
        logDebug(
            makeDebugEntryError(
                "",
                undefined,
                `heading-stale: unchanged for ${sharedState.stalenessTracker.getTurnsSinceUpdate()} turns`,
                "",
            ),
        );
    }
    if (!sharedState.stalenessTracker.isStale(5)) {
        sharedState.staleLogged = false;
    }
}

export function handleTurnEnd(
    event: TurnEndEvent,
    ctx: ExtensionContext,
    pi: ExtensionAPI,
    sharedState: SharedState,
): void {
    const myDisplayGeneration = ++sharedState.displayGeneration;
    if (!ctx.hasUI) return;

    const sessionId = ctx.sessionManager.getSessionId();
    const existing = getBranchState(ctx);
    const hasToolResults = (event.toolResults?.length ?? 0) > 0;
    const assistantText = extractAgentText(event.message);

    sharedState.stalenessTracker.onTurnEnd(existing?.goal);

    if (hasToolResults) {
        if (!assistantText.trim()) return;

        // Intermediate tool turn: distill the agent's latest activity into an
        // in-progress line for the streaming row. Not persisted; the final
        // turn still produces the checkmarked achievement.
        const myGeneration = sharedState.turnGeneration;
        void (async () => {
            try {
                const result = await summarizeAchievement(
                    ctx,
                    assistantText,
                    existing?.goal,
                );
                const progress = result.text.trim();
                if (!progress) return;
                if (myGeneration !== sharedState.turnGeneration) return;
                if (myDisplayGeneration !== sharedState.displayGeneration)
                    return;
                setHeadingMessage(ctx, progress, "working");
                logDebug(
                    makeDebugEntryAchievement(
                        assistantText,
                        result,
                        existing,
                        ctx.model?.id,
                    ),
                );
            } catch {
                // In-progress updates are cosmetic; the final achievement path
                // reports failures. Never notify from an intermediate turn.
            }
        })();
        return;
    }

    if (!assistantText.trim()) return;

    const myGeneration = sharedState.turnGeneration;

    // Fire-and-forget: achievement generation must not delay agent settlement.
    void (async () => {
        try {
            const achResult = await summarizeAchievement(
                ctx,
                assistantText,
                existing?.goal,
            );
            const achievement = achResult.text.trim();
            if (!achievement) {
                logDebug(
                    makeDebugEntryAchievement(
                        assistantText,
                        achResult,
                        existing,
                        ctx.model?.id,
                    ),
                );
                return;
            }

            if (myGeneration !== sharedState.turnGeneration) return;

            // Re-read branch state in case goal summarization completed while
            // achievement generation was in flight.
            const fresh = getBranchState(ctx);
            const state = {
                topic: fresh?.topic ?? existing?.topic ?? "",
                goal: fresh?.goal ?? existing?.goal ?? "",
                achievement,
                // Context restarts: the next goal supplements from this achievement.
                priorOutcome: achievement,
                priorAge: 0,
            };

            if (sessionId) {
                setState(sessionId, state);
                const prior = fresh ?? existing;
                if (
                    prior?.topic !== state.topic ||
                    prior?.goal !== state.goal ||
                    prior?.achievement !== state.achievement ||
                    prior?.priorOutcome !== state.priorOutcome ||
                    prior?.priorAge !== state.priorAge
                ) {
                    persistState(pi, state);
                }
            }
            setHeadingMessage(ctx, achievement, "achievement");
            exposeHeading(pi, state, "achievement");
            logDebug(
                makeDebugEntryAchievement(
                    assistantText,
                    achResult,
                    existing,
                    ctx.model?.id,
                ),
            );
        } catch (err) {
            if (myGeneration !== sharedState.turnGeneration) return;
            if (
                ctx.signal?.aborted ||
                (err as { name?: string }).name === "AbortError"
            )
                return;
            const message = (err as Error).message ?? String(err);
            ctx.ui.notify(
                `[pi-heading] Achievement summarize failed: ${message}`,
                "error",
            );
            logDebug(
                makeDebugEntryError(
                    assistantText.slice(0, 200),
                    existing,
                    message,
                    ctx.model?.id,
                ),
            );
        }
    })();
}

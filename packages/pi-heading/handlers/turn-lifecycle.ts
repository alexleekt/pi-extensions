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
    getState,
    persistState,
    setState,
} from "../state/store.js";
import { clearHeading, setHeadingMessage } from "../ui/indicator.js";
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

    const leafId = ctx.sessionManager.getLeafId();
    const state = leafId ? getState(leafId) : undefined;
    // If a placeholder from the current turn is active, don't overwrite it
    // with stale state from a previous turn.
    if (sharedState.currentPlaceholder) {
        setHeadingMessage(ctx, sharedState.currentPlaceholder, "working");
    } else if (state?.goal) {
        setHeadingMessage(ctx, state.goal, "working");
        // De-duplicate event bus emissions — only emit if state changed
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

    // Staleness warning: log once when heading hasn't changed for many turns
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
    // Reset stale flag when heading is no longer stale
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
    if (!ctx.hasUI) return;

    const leafId = ctx.sessionManager.getLeafId();
    const existing = leafId ? getState(leafId) : undefined;

    const hasToolResults = event.toolResults && event.toolResults.length > 0;

    const assistantText = extractAgentText(event.message);

    // Track staleness at the end of every turn
    sharedState.stalenessTracker.onTurnEnd(existing?.goal);

    if (hasToolResults) {
        if (assistantText.trim()) {
            logDebug(
                makeDebugEntryError(
                    assistantText.slice(0, 200),
                    existing,
                    "skipped-achievement: intermediate tool turn",
                    ctx.model?.id,
                ),
            );
        }
        return;
    }

    if (!assistantText.trim()) return;

    const myGeneration = sharedState.turnGeneration;

    // Fire-and-forget: do not block the next turn
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

            if (myGeneration !== sharedState.turnGeneration) return; // stale turn

            // Re-read fresh state in case the before_agent_start summarization
            // already updated the goal for the next turn while we were async.
            const fresh = leafId ? getState(leafId) : undefined;

            const state = {
                topic: fresh?.topic ?? existing?.topic ?? "",
                goal: fresh?.goal ?? existing?.goal ?? "",
                achievement,
            };

            if (leafId) {
                setState(leafId, state);
                // Persist if anything changed vs the fresh (or captured) state
                const prior = fresh ?? existing;
                if (
                    prior?.topic !== state.topic ||
                    prior?.goal !== state.goal ||
                    prior?.achievement !== state.achievement
                ) {
                    persistState(pi, state);
                }
            }
            setHeadingMessage(ctx, state.goal, "goal");
            exposeHeading(pi, state, "achievement");
            pi.sendMessage(
                {
                    customType: "heading-achievement",
                    content: achievement,
                    display: true,
                    details: { goal: state.goal },
                },
                { triggerTurn: false },
            );
            logDebug(
                makeDebugEntryAchievement(
                    assistantText,
                    achResult,
                    existing,
                    ctx.model?.id,
                ),
            );
        } catch (err) {
            if (myGeneration !== sharedState.turnGeneration) return; // stale turn
            // Achievement summarization failure is non-fatal — keep showing the goal
            const msg = (err as Error).message ?? String(err);
            ctx.ui.notify(
                `[pi-heading] Achievement summarize failed: ${msg}`,
                "error",
            );
            logDebug(
                makeDebugEntryError(
                    assistantText.slice(0, 200),
                    existing,
                    msg,
                    ctx.model?.id,
                ),
            );
        }
    })();
}

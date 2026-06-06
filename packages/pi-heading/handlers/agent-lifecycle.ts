// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type {
    BeforeAgentStartEventResult,
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { summarize } from "../llm/summarize.js";
import { logDebug } from "../state/debug.js";
import { stableTopic } from "../state/guard.js";
import {
    clearExposure,
    exposeHeading,
    getState,
    persistState,
    setState,
} from "../state/store.js";
import { clearHeading, setHeadingMessage } from "../ui/indicator.js";
import { makeDebugEntry, makeDebugEntryError } from "./debug.js";
import type { SharedState } from "./session-lifecycle.js";

export function handleAgentEnd(
    _event: unknown,
    ctx: ExtensionContext,
    pi: ExtensionAPI,
    sharedState: SharedState,
): void {
    if (!ctx.hasUI) return;
    sharedState.agentStartedForCurrentTurn = false;
    sharedState.agentEndGeneration++;
    sharedState.currentPlaceholder = undefined;
    const leafId = ctx.sessionManager.getLeafId();
    const state = leafId ? getState(leafId) : undefined;
    if (state?.goal) {
        setHeadingMessage(ctx, state.goal, "goal");
        exposeHeading(pi, state, state.achievement ? "achievement" : "goal");
        if (state.achievement) {
            pi.sendMessage(
                {
                    customType: "heading-achievement",
                    content: state.achievement,
                    display: true,
                    details: { goal: state.goal },
                },
                { triggerTurn: false },
            );
        }
    } else {
        clearHeading(ctx);
        clearExposure(pi);
    }
}

export function handleAgentStart(
    _event: unknown,
    ctx: ExtensionContext,
    pi: ExtensionAPI,
    sharedState: SharedState,
): void {
    if (!ctx.hasUI) return;
    sharedState.agentStartedForCurrentTurn = true;

    const leafId = ctx.sessionManager.getLeafId();
    const state = leafId ? getState(leafId) : undefined;
    // If a placeholder from the current turn is active, don't overwrite it
    // with stale state from a previous turn.
    if (sharedState.currentPlaceholder) {
        setHeadingMessage(ctx, sharedState.currentPlaceholder, "working");
    } else if (state?.goal) {
        setHeadingMessage(ctx, state.goal, "working");
        exposeHeading(pi, state, "working");
    }
}

export function handleBeforeAgentStart(
    event: { prompt?: string; systemPrompt: string },
    ctx: ExtensionContext,
    pi: ExtensionAPI,
    sharedState: SharedState,
): BeforeAgentStartEventResult | void {
    const prompt = event.prompt?.trim();
    if (!prompt || !ctx.hasUI) return;

    const myGeneration = ++sharedState.turnGeneration;
    const myAgentEndGeneration = sharedState.agentEndGeneration;
    sharedState.agentStartedForCurrentTurn = false;

    const leafId = ctx.sessionManager.getLeafId();

    // Inject current goal into system prompt so the LLM sees it as context.
    const existing = leafId ? getState(leafId) : undefined;
    const systemPrompt = existing?.goal
        ? `${event.systemPrompt}\n\n## Session Focus\nCurrent goal: ${existing.goal}. Stay focused on this goal. If the user shifts topic, acknowledge the shift and update the heading.`
        : undefined;

    // Set an immediate placeholder so the user never sees the platform
    // default "Working" while the async summarize is in progress.
    const placeholder = prompt.length > 57 ? `${prompt.slice(0, 57)}…` : prompt;
    sharedState.currentPlaceholder = placeholder;
    setHeadingMessage(ctx, placeholder, "working");

    // Store placeholder as temporary state so the heading tool can see it
    // while the async summarize is still in progress.
    if (leafId) {
        setState(leafId, {
            topic: existing?.topic ?? "General",
            goal: placeholder,
            achievement: existing?.achievement,
        });
    }

    // Fire-and-forget: do not await summarize — we must not block the agent
    void (async () => {
        try {
            const result = await summarize(ctx, prompt);
            if (myGeneration !== sharedState.turnGeneration) return; // stale turn
            // If agent_end already fired for this turn, don't clobber the final display.
            if (myAgentEndGeneration !== sharedState.agentEndGeneration) return;

            const existing = leafId ? getState(leafId) : undefined;

            if (!result.goal.trim()) {
                // LLM returned an empty goal — promote the placeholder to the
                // actual goal so the heading is never blank.
                const fallbackGoal = placeholder;
                const state = {
                    topic: existing?.topic ?? "General",
                    goal: fallbackGoal,
                    achievement: existing?.achievement,
                };
                if (leafId) {
                    setState(leafId, state);
                    if (
                        existing?.topic !== state.topic ||
                        existing?.goal !== state.goal ||
                        existing?.achievement !== state.achievement
                    ) {
                        persistState(pi, state);
                    }
                }
                sharedState.currentPlaceholder = undefined;
                const mode = sharedState.agentStartedForCurrentTurn
                    ? "working"
                    : "goal";
                setHeadingMessage(ctx, fallbackGoal, mode);
                exposeHeading(pi, state, mode);
                logDebug(
                    makeDebugEntry(prompt, result, existing, ctx.model?.id),
                );
                return;
            }

            const stable = stableTopic(existing?.topic, result.topic);
            const state = {
                topic: stable,
                goal: result.goal,
                achievement: existing?.achievement,
            };

            if (leafId) {
                setState(leafId, state);
                if (
                    existing?.topic !== state.topic ||
                    existing?.goal !== state.goal ||
                    existing?.achievement !== state.achievement
                ) {
                    persistState(pi, state);
                }
            }

            sharedState.currentPlaceholder = undefined;
            const mode = sharedState.agentStartedForCurrentTurn
                ? "working"
                : "goal";
            setHeadingMessage(ctx, result.goal, mode);
            exposeHeading(pi, state, mode);
            logDebug(
                makeDebugEntry(prompt, result, existing, ctx.model?.id, stable),
            );
        } catch (err) {
            if (myGeneration !== sharedState.turnGeneration) return; // stale turn
            if (myAgentEndGeneration !== sharedState.agentEndGeneration) return;
            const msg = (err as Error).message ?? String(err);
            ctx.ui.notify(`[pi-heading] Summarize failed: ${msg}`, "error");
            const existing = leafId ? getState(leafId) : undefined;
            logDebug(makeDebugEntryError(prompt, existing, msg, ctx.model?.id));
        }
    })();

    return systemPrompt ? { systemPrompt } : undefined;
}

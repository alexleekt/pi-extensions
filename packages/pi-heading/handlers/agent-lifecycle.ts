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
    getBranchState,
    persistState,
    setState,
} from "../state/store.js";
import { clearHeading, setHeadingMessage } from "../ui/indicator.js";
import { makeDebugEntry, makeDebugEntryError } from "./debug.js";
import type { SharedState } from "./session-lifecycle.js";
import type { State } from "../types.js";

/**
 * Low-weight context for goal extraction: the previous achievement
 * supplements the first follow-up goals and decays to nothing as more
 * turns pass (age 0–1 full, age 2 lighter, ≥3 omitted).
 */
export function goalContext(state?: State): string | undefined {
    if (!state?.achievement) return undefined;
    const age = state.turnsSinceAchievement ?? 99;
    if (age > 2) return undefined;
    const label = age <= 1 ? "Previous outcome" : "Older outcome (low weight)";
    return `Reference ${label.toLowerCase()} (the latest message wins): ${state.achievement}`;
}

/** Age the context counter; keeps prior values when no achievement exists. */
function agedState(state?: State): Partial<State> {
    if (state?.turnsSinceAchievement === undefined) return {};
    return { turnsSinceAchievement: state.turnsSinceAchievement + 1 };
}

export function handleAgentSettled(
    _event: unknown,
    ctx: ExtensionContext,
    pi: ExtensionAPI,
    sharedState: SharedState,
): void {
    if (!ctx.hasUI) return;
    sharedState.agentStartedForCurrentTurn = false;
    sharedState.agentSettledGeneration++;
    sharedState.currentPlaceholder = undefined;

    const state = getBranchState(ctx);
    if (state?.goal) {
        const mode = state.achievement ? "achievement" : "goal";
        setHeadingMessage(ctx, state.achievement ?? state.goal, mode);
        exposeHeading(pi, state, mode);
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

    const state = getBranchState(ctx);
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
): BeforeAgentStartEventResult | undefined {
    const prompt = event.prompt?.trim();
    if (!prompt || !ctx.hasUI) return;

    const myGeneration = ++sharedState.turnGeneration;
    const myAgentSettledGeneration = sharedState.agentSettledGeneration;
    sharedState.agentStartedForCurrentTurn = false;

    const sessionId = ctx.sessionManager.getSessionId();

    // Inject current goal into system prompt so the LLM sees it as context.
    const existing = getBranchState(ctx);
    const systemPrompt = existing?.goal
        ? `${event.systemPrompt}\n\n## Session Focus\nCurrent goal: ${existing.goal}. Stay focused on this goal. If the user shifts topic, acknowledge the shift and update the heading.`
        : undefined;

    // Set an immediate placeholder so the user never sees the platform
    // default "Working" while the async summarize is in progress.
    const placeholder = prompt.length > 57 ? `${prompt.slice(0, 57)}…` : prompt;
    sharedState.currentPlaceholder = placeholder;
    setHeadingMessage(ctx, placeholder, "working");

    // Keep the prompt-derived placeholder in memory only. Persisting raw prompt
    // text would expose it through branch history and the heading tool.

    // Fire-and-forget: do not await summarize — we must not block the agent.
    void (async () => {
        try {
            const result = await summarize(
                ctx,
                prompt,
                goalContext(existing),
            );
            if (myGeneration !== sharedState.turnGeneration) return;
            // A settled run may have already restored the final display.
            if (myAgentSettledGeneration !== sharedState.agentSettledGeneration)
                return;

            const current = getBranchState(ctx);

            if (!result.goal.trim()) {
                const state = {
                    topic: current?.topic ?? existing?.topic ?? "General",
                    goal:
                        current?.goal ??
                        existing?.goal ??
                        "Continue current task",
                    achievement: undefined,
                    ...agedState(current ?? existing),
                };
                if (sessionId) {
                    setState(sessionId, state);
                    if (
                        current?.topic !== state.topic ||
                        current?.goal !== state.goal ||
                        current?.achievement !== state.achievement
                    ) {
                        persistState(pi, state);
                    }
                }
                sharedState.currentPlaceholder = undefined;
                const mode = sharedState.agentStartedForCurrentTurn
                    ? "working"
                    : "goal";
                setHeadingMessage(ctx, state.goal, mode);
                exposeHeading(pi, state, mode);
                logDebug(
                    makeDebugEntry(prompt, result, current, ctx.model?.id),
                );
                return;
            }

            const stable = stableTopic(current?.topic, result.topic);
            const state = {
                topic: stable,
                goal: result.goal,
                achievement: undefined,
                ...agedState(current ?? existing),
            };

            if (sessionId) {
                setState(sessionId, state);
                if (
                    current?.topic !== state.topic ||
                    current?.goal !== state.goal ||
                    current?.achievement !== state.achievement
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
                makeDebugEntry(prompt, result, current, ctx.model?.id, stable),
            );
        } catch (err) {
            if (myGeneration !== sharedState.turnGeneration) return;
            if (myAgentSettledGeneration !== sharedState.agentSettledGeneration)
                return;
            if (
                ctx.signal?.aborted ||
                (err as { name?: string }).name === "AbortError"
            )
                return;
            const message = (err as Error).message ?? String(err);
            ctx.ui.notify(`[pi-heading] Summarize failed: ${message}`, "error");
            logDebug(
                makeDebugEntryError(
                    prompt,
                    getBranchState(ctx),
                    message,
                    ctx.model?.id,
                ),
            );
        }
    })();

    return systemPrompt ? { systemPrompt } : undefined;
}

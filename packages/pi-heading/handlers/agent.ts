// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { summarize } from "../llm/summarize.js";
import { logDebug } from "../state/debug.js";
import { stableTopic } from "../state/guard.js";
import { clearExposure, exposeHeading, getState, persistState, setState } from "../state/store.js";
import { clearHeading, setHeadingMessage } from "../ui/widget.js";
import { makeDebugEntry, makeDebugEntryError } from "./debug.js";
import type { SharedState } from "./session.js";

export function handleAgentEnd(
  _event: unknown,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  sharedState: SharedState,
): void {
  if (!ctx.hasUI) return;
  sharedState.agentStartedForCurrentTurn = false;
  const leafId = ctx.sessionManager.getLeafId();
  const state = leafId ? getState(leafId) : undefined;
  // Restore Pi's native loader first, then set our custom message.
  // This prevents setWorkingVisible(true) from resetting the message
  // text back to the platform default "Working".
  ctx.ui.setWorkingVisible(true); // ensure working indicator stays visible
  if (state?.goal) {
    const mode = state.achievement ? "achievement" : "goal";
    const text = state.achievement ?? state.goal;
    setHeadingMessage(ctx, text, mode);
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

  // Suppress Pi's native "Working" loader so our widget spinner is the
  // only visible progress indicator (per ADR 0002).
  ctx.ui.setWorkingVisible(false);

  const leafId = ctx.sessionManager.getLeafId();
  const state = leafId ? getState(leafId) : undefined;
  if (state?.goal) {
    setHeadingMessage(ctx, state.goal, "working");
    exposeHeading(pi, state, "working");
  } else {
    clearHeading(ctx);
  }
}

export function handleBeforeAgentStart(
  event: { prompt?: string },
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  sharedState: SharedState,
): void {
  const prompt = event.prompt?.trim();
  if (!prompt || !ctx.hasUI) return;

  const myGeneration = ++sharedState.turnGeneration;
  sharedState.agentStartedForCurrentTurn = false;

  const leafId = ctx.sessionManager.getLeafId();

  // Set an immediate placeholder so the user never sees the platform
  // default "Working" while the async summarize is in progress.
  const placeholder = prompt.length > 57 ? prompt.slice(0, 57) + "…" : prompt;
  setHeadingMessage(ctx, placeholder, "working");

  // Fire-and-forget: do not await summarize — we must not block the agent
  void (async () => {
    try {
      const result = await summarize(ctx, prompt);
      if (myGeneration !== sharedState.turnGeneration) return; // stale turn

      const existing = leafId ? getState(leafId) : undefined;

      if (!result.goal.trim()) {
        // LLM returned an empty goal — keep the user's prompt as
        // the working message instead of leaving it blank.
        setHeadingMessage(ctx, placeholder, "working");
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

      const mode = sharedState.agentStartedForCurrentTurn ? "working" : "goal";
      setHeadingMessage(ctx, result.goal, mode);
      exposeHeading(pi, state, mode);
      logDebug(
        makeDebugEntry(
          prompt,
          result,
          existing,
          ctx.model?.id,
          stable,
        ),
      );
    } catch (err) {
      if (myGeneration !== sharedState.turnGeneration) return; // stale turn
      const msg = (err as Error).message ?? String(err);
      ctx.ui.notify(`[pi-heading] Summarize failed: ${msg}`, "error");
      const existing = leafId ? getState(leafId) : undefined;
      logDebug(
        makeDebugEntryError(prompt, existing, msg, ctx.model?.id),
      );
    }
  })();
}

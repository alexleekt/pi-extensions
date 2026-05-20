// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { summarize } from "./llm/summarize.js";
import { stableTopic } from "./state/guard.js";
import {
  getState,
  setState,
  replayBranch,
  persistState,
  type State,
} from "./state/store.js";
import { renderWidget, clearWidget } from "./ui/widget.js";
import { getDebugMode, setDebugMode, setModelOverride, resolveModelId } from "./llm/picker.js";
import { setDebugEnabled, logDebug, readDebugLog, clearDebugLog, DEBUG_LOG } from "./state/debug.js";
import type { SummarizeResult } from "./llm/summarize.js";
import type { DebugEntry } from "./state/debug.js";

function baseDebugEntry(prompt: string, modelId?: string): Pick<DebugEntry, "t" | "input" | "prompt" | "modelId"> {
  return {
    t: new Date().toISOString(),
    input: prompt,
    prompt: prompt.slice(0, 200),
    modelId,
  };
}

function makeDebugEntry(
  prompt: string,
  result: SummarizeResult,
  existing: State | undefined,
  modelId?: string,
  stableTopic?: string,
): DebugEntry {
  return {
    ...baseDebugEntry(prompt, modelId),
    fullTopicPrompt: result.fullTopicPrompt,
    fullGoalPrompt: result.fullGoalPrompt,
    topicResponse: result.topic,
    goalResponse: result.goal,
    rawTopic: result.topic,
    rawGoal: result.goal,
    stableTopic: stableTopic ?? existing?.topic ?? "",
    finalGoal: result.goal || (existing?.goal ?? ""),
    topicStream: result.topicDebug,
    goalStream: result.goalDebug,
    topicSystemPrompt: result.topicSystemPrompt,
    goalSystemPrompt: result.goalSystemPrompt,
  };
}

function makeDebugEntryError(
  prompt: string,
  existing: State | undefined,
  error: string,
  modelId?: string,
): DebugEntry {
  return {
    ...baseDebugEntry(prompt, modelId),
    fullTopicPrompt: "",
    fullGoalPrompt: "",
    topicResponse: "",
    goalResponse: "",
    rawTopic: "",
    rawGoal: "",
    stableTopic: existing?.topic ?? "",
    finalGoal: existing?.goal ?? "",
    error,
  };
}

export default function (pi: ExtensionAPI) {
  // ── Debug init ───────────────────────────────────────────────────
  const debugEnabled = getDebugMode();
  setDebugEnabled(debugEnabled);

  // ── Session lifecycle ──────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    const replayed = replayBranch(ctx);
    if (replayed) {
      renderWidget(ctx, replayed.goal);
    } else {
      clearWidget(ctx);
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    clearWidget(ctx);
  });

  // ── Summarize on every user message ────────────────────────────

  pi.on("before_agent_start", (event, ctx) => {
    const prompt = event.prompt?.trim();
    if (!prompt || !ctx.hasUI) return;

    const leafId = ctx.sessionManager.getLeafId();

    // Fire-and-forget: do not await summarize — we must not block the agent
    void (async () => {
      try {
        const result = await summarize(ctx, prompt);
        const existing = leafId ? getState(leafId) : undefined;

        if (!result.goal.trim()) {
          logDebug(makeDebugEntry(prompt, result, existing, ctx.model?.id));
          return;
        }

        const stable = stableTopic(existing?.topic, result.topic);
        const state: State = { topic: stable, goal: result.goal };

        if (leafId) {
          setState(leafId, state);
          if (existing?.topic !== state.topic || existing?.goal !== state.goal) {
            persistState(pi, state);
          }
        }
        renderWidget(ctx, result.goal);
        logDebug(makeDebugEntry(prompt, result, existing, ctx.model?.id, stable));
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        ctx.ui.notify(`[pi-heading] Summarize failed: ${msg}`, "error");
        const existing = leafId ? getState(leafId) : undefined;
        logDebug(makeDebugEntryError(prompt, existing, msg, ctx.model?.id));
      }
    })();
  });

  // ── Slash command: /heading ────────────────────────────────────

  pi.registerCommand("heading", {
    description: "Manually set the session heading",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      const input = await ctx.ui.input("Session heading");
      if (!input || !input.trim()) return;

      const goal = input.trim();
      const leafId = ctx.sessionManager.getLeafId();
      const existing = leafId ? getState(leafId) : undefined;
      const state: State = { topic: existing?.topic ?? "manual", goal };

      if (leafId) {
        setState(leafId, state);
        persistState(pi, state);
      }
      renderWidget(ctx, goal);
      ctx.ui.notify(`Heading set: ${goal}`, "info");
    },
  });

  // ── Slash command: /heading-model ──────────────────────────────

  pi.registerCommand("heading-model", {
    description: "Change the model used for heading summarization",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;

      const registry = ctx.modelRegistry;
      const available = registry.getAvailable();
      if (!available.length) {
        ctx.ui.notify("[pi-heading] No models available in registry", "error");
        return;
      }

      const current = resolveModelId(ctx);

      const choices = [
        "↺ Reset to session model",
        ...available.map((m) => {
          const marker = m.id === current ? "● " : "  ";
          const provider = m.provider ? ` (${m.provider})` : "";
          return `${marker}${m.id}${provider}`;
        }),
      ];

      const selectedLine = await ctx.ui.select("Select heading model", choices);
      if (!selectedLine) return;

      if (selectedLine === "↺ Reset to session model") {
        setModelOverride(undefined);
        ctx.ui.notify(`[pi-heading] Heading model reset — using session model (${ctx.model?.id ?? "none"})`, "info");
        return;
      }

      const selected = selectedLine.replace(/^\s*[●]?\s*/, "").split(" (")[0];
      const model = available.find((m) => m.id === selected);
      if (!model) {
        ctx.ui.notify(`[pi-heading] Model ${selected} not found`, "error");
        return;
      }

      const auth = await registry.getApiKeyAndHeaders(model);
      if (!auth.ok || !auth.apiKey) {
        ctx.ui.notify(`[pi-heading] Model ${selected} has no API key configured`, "warning");
      }

      setModelOverride(selected);
      ctx.ui.notify(`[pi-heading] Heading model set to ${selected}`, "info");
    },
  });

  // ── Slash command: /heading-debug ───────────────────────────────

  pi.registerCommand("heading-debug", {
    description: "Toggle or show pi-heading debug info",
    handler: async (args, ctx) => {
      const arg = args?.trim().toLowerCase();

      if (arg === "on") {
        setDebugMode(true);
        setDebugEnabled(true);
        ctx.ui.notify(`[pi-heading] Debug mode ON — logging to ${DEBUG_LOG}`, "info");
        return;
      }
      if (arg === "off") {
        setDebugMode(false);
        setDebugEnabled(false);
        ctx.ui.notify("[pi-heading] Debug mode OFF", "info");
        return;
      }
      if (arg === "clear") {
        clearDebugLog();
        ctx.ui.notify("[pi-heading] Debug log cleared", "info");
        return;
      }

      // Default: show last entries
      const entries = readDebugLog(10);
      if (entries.length === 0) {
        ctx.ui.notify(
          `[pi-heading] No debug entries. Debug is ${debugEnabled ? "ON" : "OFF"}. Use "/heading-debug on" to enable.`,
          "info",
        );
        return;
      }

      const lines = entries.map((e) => {
        const ts = e.t.split("T")[1]?.slice(0, 8) ?? e.t;
        const err = e.error ? ` ❌ ${e.error.slice(0, 60)}` : "";
        const rawGoal = e.goalResponse || e.rawGoal || "";
        let streamInfo = "";
        if (e.goalStream?.extractedText) {
          streamInfo = ` 📡${e.goalStream.extractedText.length}c`;
        } else if (e.goalStream?.errorEvent) {
          streamInfo = ` 💥${e.goalStream.errorEvent.slice(0, 20)}`;
        }
        const frontmatterLeak = e.goalSystemPrompt?.includes("max_words:") ? " ⚠️FRONTMATTER_LEAK" : "";
        return `${ts} ▸ goal:"${rawGoal.slice(0, 40)}" final:"${e.finalGoal.slice(0, 40)}"${streamInfo}${err}${frontmatterLeak}`;
      });

      ctx.ui.notify(
        [`[pi-heading] Last ${entries.length} entries (debug=${debugEnabled ? "ON" : "OFF"}):`, ...lines].join("\n"),
        "info",
      );
    },
  });
}

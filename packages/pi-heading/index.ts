// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  getDebugMode,
  setDebugEnabled,
} from "./state/debug.js";

import {
  handleBeforeAgentStart,
  handleAgentEnd,
  handleAgentStart,
} from "./handlers/agent.js";
import {
  handleHeading,
  handleHeadingDebug,
  handleHeadingModel,
} from "./handlers/commands.js";
import {
  handleSessionShutdown,
  handleSessionStart,
  type SharedState,
} from "./handlers/session.js";
import {
  handleTurnEnd,
  handleTurnStart,
} from "./handlers/turn.js";

export default function (pi: ExtensionAPI) {
  // ── Debug init ───────────────────────────────────────────────────
  const debugEnabled = getDebugMode();
  setDebugEnabled(debugEnabled);

  // ── Shared mutable state ─────────────────────────────────────────
  const sharedState: SharedState = {
    turnGeneration: 0,
    agentStartedForCurrentTurn: false,
  };

  // ── Event handlers ─────────────────────────────────────────────
  pi.on("session_start", (_event, ctx) =>
    handleSessionStart(_event, ctx, pi, sharedState),
  );
  pi.on("agent_end", (_event, ctx) =>
    handleAgentEnd(_event, ctx, pi, sharedState),
  );
  pi.on("session_shutdown", (_event, ctx) =>
    handleSessionShutdown(_event, ctx, pi),
  );
  pi.on("before_agent_start", (event, ctx) =>
    handleBeforeAgentStart(event, ctx, pi, sharedState),
  );
  pi.on("agent_start", (_event, ctx) =>
    handleAgentStart(_event, ctx, pi, sharedState),
  );
  pi.on("turn_start", (_event, ctx) =>
    handleTurnStart(_event, ctx, pi, sharedState),
  );
  pi.on("turn_end", (event, ctx) =>
    handleTurnEnd(event, ctx, pi, sharedState),
  );

  // ── Slash commands ───────────────────────────────────────────────
  pi.registerCommand("heading", {
    description: "Manually set the session heading",
    handler: async (args, ctx) => handleHeading(args, ctx, pi),
  });
  pi.registerCommand("heading-model", {
    description: "Change the model used for heading summarization",
    handler: async (args, ctx) => handleHeadingModel(args, ctx, pi),
  });
  pi.registerCommand("heading-debug", {
    description: "Toggle or show pi-heading debug info",
    handler: async (args, ctx) => handleHeadingDebug(args, ctx, pi),
  });
}

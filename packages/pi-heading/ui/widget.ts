// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export type WidgetMode = "goal" | "working" | "achievement" | "idle";

/**
 * Set the working-message footer text.
 *
 * The `mode` parameter is only used to distinguish `idle` (clear) from active
 * states. All active modes (goal, working, achievement) render identically
 * since the setWidget → setWorkingMessage migration removed prefixes.
 */
export function setHeadingMessage(
  ctx: ExtensionContext,
  text: string,
  mode: WidgetMode = "goal",
): void {
  const trimmed = text.trim();
  if (!trimmed || mode === "idle") {
    clearHeading(ctx);
    return;
  }

  ctx.ui.setWorkingMessage(trimmed);
}

export function clearHeading(ctx: ExtensionContext): void {
  ctx.ui.setWorkingMessage("");
}

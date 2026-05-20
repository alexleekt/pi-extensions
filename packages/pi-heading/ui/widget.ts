// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

const WIDGET_KEY = "pi-heading";

export function renderWidget(ctx: ExtensionContext, goal: string): void {
  const trimmed = goal.trim();
  if (!trimmed) {
    // Don't show a lone prefix — clear instead
    clearWidget(ctx);
    return;
  }

  const theme = ctx.ui.theme;

  // One plain line — no borders, no components, no background
  const line = `${theme.fg("muted", "▸ ")}${theme.fg("text", trimmed)}`;

  ctx.ui.setWidget(WIDGET_KEY, [line]);
}

export function clearWidget(ctx: ExtensionContext): void {
  ctx.ui.setWidget(WIDGET_KEY, undefined);
}

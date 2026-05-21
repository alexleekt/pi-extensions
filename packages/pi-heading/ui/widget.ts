// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

const WIDGET_KEY = "pi-heading";

const SPINNER_CHARS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧"];
const SPINNER_INTERVAL_MS = 120;

let spinnerTimer: ReturnType<typeof setInterval> | null = null;
let spinnerIndex = 0;

export type WidgetMode = "goal" | "working" | "achievement";

export function renderWidget(
  ctx: ExtensionContext,
  text: string,
  mode: WidgetMode = "goal",
): void {
  const trimmed = text.trim();
  if (!trimmed) {
    clearWidget(ctx);
    return;
  }

  if (mode !== "working") {
    stopSpinner();
  }

  const theme = ctx.ui.theme;
  let prefix: string;

  if (mode === "working") {
    prefix = SPINNER_CHARS[spinnerIndex];
    startSpinner(ctx, trimmed);
  } else if (mode === "achievement") {
    prefix = "✓";
  } else {
    prefix = "▸";
  }

  const line = `${theme.fg("muted", prefix + " ")}${theme.fg("text", trimmed)}`;
  ctx.ui.setWidget(WIDGET_KEY, [line]);
}

function startSpinner(ctx: ExtensionContext, text: string): void {
  if (spinnerTimer) clearInterval(spinnerTimer);
  spinnerIndex = 0;
  spinnerTimer = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % SPINNER_CHARS.length;
    const prefix = SPINNER_CHARS[spinnerIndex];
    const theme = ctx.ui.theme;
    const line = `${theme.fg("muted", prefix + " ")}${theme.fg("text", text)}`;
    ctx.ui.setWidget(WIDGET_KEY, [line]);
  }, SPINNER_INTERVAL_MS);
}

export function stopSpinner(): void {
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
  }
}

export function clearWidget(ctx: ExtensionContext): void {
  stopSpinner();
  ctx.ui.setWidget(WIDGET_KEY, undefined);
}

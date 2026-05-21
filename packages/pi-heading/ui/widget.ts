// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

const WIDGET_KEY = "pi-heading";

const SPINNER_CHARS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧"];
const SPINNER_INTERVAL_MS = 120;

let spinnerTimer: ReturnType<typeof setInterval> | null = null;
let spinnerIndex = 0;
let currentSpinnerText = "";

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
  if (spinnerTimer && currentSpinnerText === text) {
    // Already running with same text — don't thrash between turn_start events
    return;
  }
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    // Preserve spinnerIndex for smooth restarts between turn_start events
  } else {
    spinnerIndex = 0;
  }
  currentSpinnerText = text;
  spinnerTimer = setInterval(() => {
    try {
      spinnerIndex = (spinnerIndex + 1) % SPINNER_CHARS.length;
      const prefix = SPINNER_CHARS[spinnerIndex];
      const theme = ctx.ui.theme;
      const line = `${theme.fg("muted", prefix + " ")}${theme.fg("text", currentSpinnerText)}`;
      ctx.ui.setWidget(WIDGET_KEY, [line]);
    } catch {
      // Defensive: don't let widget errors kill the spinner interval.
    }
  }, SPINNER_INTERVAL_MS);
}

export function stopSpinner(): void {
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
  }
  currentSpinnerText = "";
}

/** Returns true if the Braille spinner interval is currently active. */
export function isSpinnerRunning(): boolean {
  return spinnerTimer !== null;
}

export function clearWidget(ctx: ExtensionContext): void {
  stopSpinner();
  ctx.ui.setWidget(WIDGET_KEY, undefined);
}

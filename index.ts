// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const THRESHOLD_MS = 300;
const DEFAULT_NUDGE_MESSAGE = "Bump"; // TODO: make configurable via config file

export default function bumpExtension(pi: ExtensionAPI) {
  let unsubscribe: (() => void) | null = null;

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;

    unsubscribe?.();

    let lastEmptyEnter = 0;

    unsubscribe = ctx.ui.onTerminalInput((data) => {
      if (data !== "\r" && data !== "\n") return;

      const editorText = ctx.ui.getEditorText().trim();
      if (editorText.length > 0) return;

      const now = Date.now();
      if (now - lastEmptyEnter < THRESHOLD_MS) {
        lastEmptyEnter = 0;
        if (ctx.isIdle() && !ctx.hasPendingMessages()) {
          pi.sendUserMessage(DEFAULT_NUDGE_MESSAGE);
        }
        return { consume: true };
      }

      lastEmptyEnter = now;
      return;
    });
  });

  pi.on("session_shutdown", () => {
    unsubscribe?.();
    unsubscribe = null;
  });
}

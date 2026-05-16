import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function bumpExtension(pi: ExtensionAPI) {
  let lastEmptyEnter = 0;
  let unsubscribe: (() => void) | null = null;
  const THRESHOLD_MS = 300;
  const DEFAULT_NUDGE_MESSAGE = "Bump"; // TODO: make configurable via config file

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;

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
      return { consume: true };
    });
  });

  pi.on("session_shutdown", () => {
    unsubscribe?.();
    unsubscribe = null;
  });
}

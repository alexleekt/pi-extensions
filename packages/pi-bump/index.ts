// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { manageSessionSubscription } from "@alexleekt/pi-shared/session";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Double-tap detection window (ms).
const THRESHOLD_MS = 300;

// Randomly selected prompts to avoid repetition.
const NUDGE_MESSAGES = [
    "Continue",
    "Keep going",
    "What's next?",
    "Onward!",
    "And then?",
    "More please",
    "Next step?",
    "Keep the momentum",
    "Let's see it",
    "Proceed",
    "Go on",
    "Carry on",
    "Move forward",
    "Keep at it",
    "Press on",
];

function pickNudge(): string {
    return NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)];
}

export default function bumpExtension(pi: ExtensionAPI) {
    const sub = manageSessionSubscription(pi);

    pi.on("session_start", (_event, ctx) => {
        if (!ctx.hasUI) return;

        let lastEmptyEnter = 0;

        sub.set(
            ctx.ui.onTerminalInput((data) => {
                if (data !== "\r" && data !== "\n") return;

                const editorText = ctx.ui.getEditorText().trim();
                if (editorText.length > 0) return;

                const now = Date.now();
                if (now - lastEmptyEnter < THRESHOLD_MS) {
                    lastEmptyEnter = 0;
                    if (ctx.isIdle() && !ctx.hasPendingMessages()) {
                        pi.sendUserMessage(pickNudge());
                    }
                    return { consume: true };
                }

                lastEmptyEnter = now;
            }),
        );
    });
}

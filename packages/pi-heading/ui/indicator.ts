// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { sanitizeText } from "../llm/parse.js";
import type { WidgetMode } from "../types.js";

const WIDGET_KEY = "pi-heading";

export function setHeadingMessage(
    ctx: ExtensionContext,
    text: string,
    mode: WidgetMode = "goal",
): void {
    const trimmed = sanitizeText(text).trim();
    if (!trimmed || mode === "idle") {
        clearHeading(ctx);
        return;
    }

    if (mode === "achievement") {
        // pi only renders the working-message row while streaming, so a
        // settle-time achievement would vanish instantly. Achievements persist
        // as a widget above the editor instead; the ✓ lives only in the UI,
        // not in persisted state or heading tool output.
        ctx.ui.setWidget(WIDGET_KEY, (_tui, theme) => {
            try {
                // Green ✓ + muted text (designer spec): the glyph carries
                // "done" for colorblind users, muted keeps the line secondary
                // to the prompt and error output.
                return new Text(
                    `${theme.fg("success", "✓ ")}${theme.fg("muted", trimmed)}`,
                );
            } catch {
                // Theme token unavailable: green + faint SGR fallback.
                return new Text(`\x1b[32m✓\x1b[0m \x1b[2m${trimmed}\x1b[0m`);
            }
        });
        ctx.ui.setWorkingMessage("");
        return;
    }

    // New work begins: the previous turn's achievement makes way.
    ctx.ui.setWidget(WIDGET_KEY, undefined);
    ctx.ui.setWorkingMessage(trimmed);
}

export function clearHeading(ctx: ExtensionContext): void {
    if (ctx.hasUI) ctx.ui.setWidget(WIDGET_KEY, undefined);
    ctx.ui.setWorkingMessage("");
}

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
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
        ctx.ui.setWidget(WIDGET_KEY, [`✓ ${trimmed}`]);
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
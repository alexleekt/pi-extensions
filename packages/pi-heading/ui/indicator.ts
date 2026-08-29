// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { WidgetMode } from "../types.js";

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

    // Achievement mode marks completion; the checkmark lives only in the
    // working-message row, not in persisted state or the heading tool output.
    ctx.ui.setWorkingMessage(mode === "achievement" ? `✓ ${trimmed}` : trimmed);
}

export function clearHeading(ctx: ExtensionContext): void {
    ctx.ui.setWorkingMessage("");
}

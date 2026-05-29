// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { WidgetMode } from "../types.js";

const SPINNER_FRAMES = [
    "⠋",
    "⠙",
    "⠹",
    "⠸",
    "⠼",
    "⠴",
    "⠦",
    "⠧",
    "⠇",
    "⠏",
];

let spinnerInterval: ReturnType<typeof setInterval> | null = null;

export function startSpinner(
    text: string,
    ctx: ExtensionContext,
): void {
    stopSpinner();
    let frame = 0;
    ctx.ui.setWorkingMessage(`${SPINNER_FRAMES[frame]} ${text}`);
    spinnerInterval = setInterval(() => {
        frame = (frame + 1) % SPINNER_FRAMES.length;
        ctx.ui.setWorkingMessage(`${SPINNER_FRAMES[frame]} ${text}`);
    }, 80);
}

export function stopSpinner(): void {
    if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
    }
}

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

    if (mode === "working") {
        startSpinner(trimmed, ctx);
        return;
    }

    stopSpinner();
    const prefix = mode === "achievement" ? "✓ " : "▸ ";
    ctx.ui.setWorkingMessage(prefix + trimmed);
}

export function clearHeading(ctx: ExtensionContext): void {
    stopSpinner();
    ctx.ui.setWorkingMessage("");
}

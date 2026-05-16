// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
//
// Shared session lifecycle utilities for Pi extensions.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Manages a per-session subscription that is cleaned up automatically
 * on `session_shutdown`.
 *
 * @example
 * ```typescript
 * const sub = manageSessionSubscription(pi);
 *
 * pi.on("session_start", (_event, ctx) => {
 *     if (!ctx.hasUI) return;
 *     sub.set(ctx.ui.onTerminalInput((data) => {
 *         // handle input
 *     }));
 * });
 * ```
 */
export function manageSessionSubscription(pi: ExtensionAPI): {
    /** Replace the active subscription (unsubscribes the previous one). */
    set(unsubscribe: (() => void) | null): void;
    /** Unsubscribe and clear the reference. */
    clear(): void;
} {
    let unsubscribe: (() => void) | null = null;

    pi.on("session_shutdown", () => {
        unsubscribe?.();
        unsubscribe = null;
    });

    return {
        set(next) {
            unsubscribe?.();
            unsubscribe = next;
        },
        clear() {
            unsubscribe?.();
            unsubscribe = null;
        },
    };
}

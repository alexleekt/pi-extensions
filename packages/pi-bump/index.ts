// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { manageSessionSubscription } from "@alexleekt/pi-shared/session";
import type {
    ExtensionAPI,
    ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { Key, matchesKey } from "@earendil-works/pi-tui";

const THRESHOLD_MS = 300;

const DEBUG_KEYS = [
    Key.enter,
    Key.backspace,
    Key.delete,
    Key.ctrl("enter"),
    Key.alt("enter"),
];

const DEBUG_KEYS_LIST = DEBUG_KEYS.join(", ");

/** Custom type used for the invisible trigger message. */
const CONTINUE_CUSTOM_TYPE = "__invisible_continue";

/** Description shown in the / commands list. */
const CONTINUE_COMMAND_DESCRIPTION =
    "Resume the agentic loop without sending a prompt the LLM can read";

function notifySafely(
    ctx: {
        ui: {
            notify: (
                message: string,
                type?: "info" | "warning" | "error",
            ) => void;
        };
    },
    message: string,
    type: "info" | "warning" | "error",
): void {
    try {
        ctx.ui.notify(message, type);
    } catch (e) {
        console.error("[pi-bump] Failed to show notification:", e);
    }
}

function findMatchedKey(data: string): string | undefined {
    return DEBUG_KEYS.find((keyId) => matchesKey(data, keyId));
}

/** Send an invisible continue message to resume the agentic loop. */
function sendInvisibleContinue(pi: ExtensionAPI): void {
    Promise.resolve(
        pi.sendMessage(
            {
                customType: CONTINUE_CUSTOM_TYPE,
                content: "",
                display: false,
                details: {},
            },
            { triggerTurn: true },
        ),
    ).catch((e) => {
        console.error("[pi-bump] Failed to send invisible continue:", e);
    });
}

async function runContinueCommand(
    pi: ExtensionAPI,
    ctx: ExtensionCommandContext,
    args: string,
): Promise<void> {
    const subcommand = args.trim().toLowerCase();

    // ---- subcommand: status -------------------------------------------------
    if (subcommand === "status") {
        const idle = ctx.isIdle();
        const hasPending = ctx.hasPendingMessages();
        notifySafely(
            ctx,
            [
                "pi-bump status:",
                `  Agent idle: ${idle ? "yes" : "no"}`,
                `  Pending messages: ${hasPending ? "yes" : "no"}`,
            ].join("\n"),
            "info",
        );
        return;
    }

    // ---- subcommand: help ---------------------------------------------------
    if (subcommand === "help") {
        notifySafely(
            ctx,
            [
                "pi-bump  /continue        Resume loop invisibly",
                "         /continue status  Show diagnostics",
                "         /continue help    This message",
                "",
                "Double-tap Enter on empty input also triggers invisible continue.",
            ].join("\n"),
            "info",
        );
        return;
    }

    // ---- main: fire invisible continue --------------------------------------
    if (!ctx.isIdle()) {
        await ctx.waitForIdle();
    }

    await pi.sendMessage(
        {
            customType: CONTINUE_CUSTOM_TYPE,
            content: "",
            display: false,
            details: {},
        },
        { triggerTurn: true },
    );
}

/**
 * Pi extension that invisibly continues the agentic loop when the user
 * double-taps Enter on an empty chat input, or when the /continue command
 * is used.
 *
 * Strategy:
 *   - Double-tap Enter or /continue sends a custom-type message with display: false
 *   - Default convertToLlm filters to user/assistant/toolResult only → custom message stripped
 *   - LLM receives unchanged context, loops naturally
 *   - Session gets one hidden entry (customType: "continue", display: false)
 */
export default function bumpExtension(pi: ExtensionAPI) {
    const sub = manageSessionSubscription(pi);
    const debugSessions = new Set<string>();

    pi.registerCommand("continue", {
        description: CONTINUE_COMMAND_DESCRIPTION,
        handler: async (args, ctx) => {
            await runContinueCommand(pi, ctx, args);
        },
    });

    if (process.env.BUMP_DEBUG === "1") {
        pi.registerCommand("bump-debug-keypresses", {
            description: "Toggle double-tap debug mode for this session",
            handler: async (_args, ctx) => {
                const sessionId = ctx.sessionManager.getSessionId();
                const isOn = debugSessions.has(sessionId);
                if (isOn) {
                    debugSessions.delete(sessionId);
                    notifySafely(ctx, "Debug mode OFF", "info");
                } else {
                    debugSessions.add(sessionId);
                    notifySafely(
                        ctx,
                        `Debug mode ON — monitored: ${DEBUG_KEYS_LIST}`,
                        "info",
                    );
                }
            },
        });
    }

    // Strip hidden continue markers from context before each LLM call.
    // This is insurance — convertToLlm already filters custom roles, but a
    // custom convertToLlm override could leak them. Clean proactively.
    pi.on("context", async (event) => {
        const cleaned = event.messages.filter(
            (msg: any) =>
                !(
                    msg.role === "custom" &&
                    msg.customType === CONTINUE_CUSTOM_TYPE
                ),
        );
        if (cleaned.length !== event.messages.length) {
            return { messages: cleaned };
        }
    });

    pi.on("session_start", (_event, ctx) => {
        if (!ctx.hasUI) return;

        const sessionId = ctx.sessionManager.getSessionId();
        let lastKeyId: string | undefined;
        let lastKeyTime = 0;

        sub.set(
            ctx.ui.onTerminalInput((data) => {
                const keyId = findMatchedKey(data);
                if (!keyId) return;

                const editorText = ctx.ui.getEditorText().trim();
                if (keyId === Key.enter && editorText.length > 0) return;

                const now = Date.now();

                // Reset stale single-tap state
                if (lastKeyId && now - lastKeyTime >= THRESHOLD_MS) {
                    lastKeyId = undefined;
                    lastKeyTime = 0;
                }

                const isDebug = debugSessions.has(sessionId);

                if (
                    keyId === lastKeyId &&
                    now - lastKeyTime < THRESHOLD_MS
                ) {
                    const duration = now - lastKeyTime;
                    lastKeyId = undefined;
                    lastKeyTime = 0;

                    if (keyId === Key.enter) {
                        if (ctx.isIdle() && !ctx.hasPendingMessages()) {
                            sendInvisibleContinue(pi);
                        }
                        if (isDebug) {
                            notifySafely(
                                ctx,
                                `Double-tap: ${keyId} (${duration}ms)`,
                                "info",
                            );
                        }
                        return { consume: true };
                    }

                    if (isDebug) {
                        notifySafely(
                            ctx,
                            `Double-tap: ${keyId} (${duration}ms)`,
                            "info",
                        );
                        return { consume: true };
                    }
                }

                lastKeyId = keyId;
                lastKeyTime = now;
            }),
        );
    });
}

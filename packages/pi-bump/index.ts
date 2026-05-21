// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { manageSessionSubscription } from "@alexleekt/pi-shared/session";
import type {
    ExtensionAPI,
    ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { Key, matchesKey } from "@earendil-works/pi-tui";

const THRESHOLD_MS = 300;

/** Signal injected into LLM context when continuing.
 *  Invisible to the user, but gives the LLM a clear semantic nudge to keep going. */
const CONTINUE_SIGNAL = "Continue";

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

/** Extract plain text from an assistant message for duplicate comparison. */
interface TextPart {
    type: string;
    text?: string;
}

function extractAssistantText(msg: {
    role: string;
    content?: string | TextPart[];
}): string | undefined {
    if (msg.role !== "assistant") return undefined;
    const content = msg.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content
            .filter((c) => c.type === "text")
            .map((c) => c.text ?? "")
            .join("");
    }
    return undefined;
}

/** Check if two assistant responses are functionally duplicates. */
function isDuplicateResponse(
    a: string | undefined,
    b: string | undefined,
): boolean {
    if (!a || !b) return false;
    // Normalize: ignore trailing whitespace and case for comparison
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

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
    lastAssistantTexts: Map<string, [string | undefined, string | undefined]>,
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

    const sessionId = ctx.sessionManager.getSessionId();
    const [prev, last] = lastAssistantTexts.get(sessionId) ?? [
        undefined,
        undefined,
    ];
    if (isDuplicateResponse(prev, last)) {
        notifySafely(
            ctx,
            "Continue blocked: last response was a duplicate. Type something new to continue.",
            "warning",
        );
        return;
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
 * Strategy (experimental hybrid):
 *   - Double-tap Enter or /continue sends a custom-type message with display: false
 *   - context event replaces the invisible message with a minimal user signal (e.g. "...")
 *   - LLM sees the minimal signal and continues meaningfully instead of repeating
 *   - Duplicate detection blocks rapid-fire continues that would loop
 *   - Real user input resets the duplicate detection state
 */
export default function bumpExtension(pi: ExtensionAPI) {
    const sub = manageSessionSubscription(pi);
    const debugSessions = new Set<string>();

    // Per-session state for duplicate detection
    const lastAssistantTexts = new Map<
        string,
        [string | undefined, string | undefined]
    >();

    pi.registerCommand("continue", {
        description: CONTINUE_COMMAND_DESCRIPTION,
        handler: async (args, ctx) => {
            await runContinueCommand(pi, ctx, args, lastAssistantTexts);
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

    // Reset duplicate detection when the user sends real input.
    pi.on("input", async (event, ctx) => {
        if (event.source === "interactive") {
            const sessionId = ctx.sessionManager.getSessionId();
            lastAssistantTexts.set(sessionId, [undefined, undefined]);
        }
    });

    // Capture assistant messages to detect duplicate responses.
    pi.on("message_end", async (event, ctx) => {
        const msg = event.message as {
            role: string;
            content?: string | Array<{ type: string; text?: string }>;
        };
        if (msg.role !== "assistant") return;
        const text = extractAssistantText(msg);
        if (!text) return;

        const sessionId = ctx.sessionManager.getSessionId();
        const [prev] = lastAssistantTexts.get(sessionId) ?? [
            undefined,
            undefined,
        ];
        lastAssistantTexts.set(sessionId, [prev, text]);
    });

    // EXPERIMENTAL: Replace invisible continue markers with minimal LLM signal.
    // Instead of stripping the custom message (which leaves identical context →
    // duplicate response), we inject a minimal user message that prompts
    // meaningful continuation without polluting the chat UI.
    pi.on("context", async (event) => {
        let modified = false;
        const messages = (
            event as {
                messages: Array<{
                    role: string;
                    customType?: string;
                    content?: string;
                    timestamp?: number;
                }>;
            }
        ).messages.map((msg) => {
            if (
                msg.role === "custom" &&
                msg.customType === CONTINUE_CUSTOM_TYPE
            ) {
                modified = true;
                // Replace with a minimal user message — visible to LLM, invisible to user
                return {
                    role: "user",
                    content: CONTINUE_SIGNAL,
                    timestamp: Date.now(),
                };
            }
            return msg;
        });
        if (modified) {
            return { messages };
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

                if (keyId === lastKeyId && now - lastKeyTime < THRESHOLD_MS) {
                    const duration = now - lastKeyTime;
                    lastKeyId = undefined;
                    lastKeyTime = 0;

                    if (keyId === Key.enter) {
                        if (ctx.isIdle() && !ctx.hasPendingMessages()) {
                            // DUPLICATE DETECTION: block if the last two
                            // assistant responses were identical (indicates
                            // the previous continue produced a loop).
                            const [prev, last] = lastAssistantTexts.get(
                                sessionId,
                            ) ?? [undefined, undefined];
                            if (isDuplicateResponse(prev, last)) {
                                notifySafely(
                                    ctx,
                                    "Continue blocked: last response was a duplicate. Type something new to continue.",
                                    "warning",
                                );
                                return { consume: true };
                            }

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

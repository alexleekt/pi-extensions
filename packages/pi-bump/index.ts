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

/** Randomized prompts to break loops with fresh phrasing. */
const NUDGE_MESSAGES = [
    "Continue",
    "Keep going",
    "What's next?",
    "Onward!",
    "And then?",
    "Build on that",
    "More please",
    "Next step?",
    "Keep the momentum",
    "Let's see it",
    "Expand on this",
    "Go deeper",
    "Proceed",
    "Keep building",
    "Show me where this leads",
    "Run it",
];

function pickNudge(): string {
    return NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)];
}

const DEBUG_KEYS = [
    Key.enter,
    Key.backspace,
    Key.delete,
    Key.ctrl("enter"),
    Key.alt("enter"),
];



/** Custom type used for the invisible trigger message. */
const CONTINUE_CUSTOM_TYPE = "__invisible_continue";

/** Description shown in the / commands list. */
const CONTINUE_COMMAND_DESCRIPTION =
    "Resume the agentic loop without sending a prompt the LLM can read";

function extractAssistantText(msg: {
    role: string;
    content?: string | Array<{ type: string; text?: string }>;
}): string | undefined {
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

/** Per-response fingerprint for loop detection. */
interface ResponseFingerprint {
    text: string | undefined;
    toolCalls: string | undefined;
}

function extractToolCallsFingerprint(msg: {
    tool_calls?: unknown[];
    toolCalls?: unknown[];
}): string | undefined {
    const calls = msg.tool_calls ?? msg.toolCalls;
    if (!calls || !Array.isArray(calls) || calls.length === 0) return undefined;
    return JSON.stringify(
        calls.map((tc: unknown) => {
            const tcRec = tc as Record<string, unknown>;
            const fn = (tcRec.function ?? tcRec.fn) as
                | Record<string, unknown>
                | undefined;
            const rawArgs = fn?.arguments ?? tcRec.arguments;
            // Normalize argument key order to avoid false negatives
            // from object key reordering across turns.
            let args: unknown = rawArgs;
            if (typeof rawArgs === "string") {
                try {
                    const parsed = JSON.parse(rawArgs);
                    args = JSON.stringify(parsed, Object.keys(parsed).sort());
                } catch {
                    args = rawArgs;
                }
            }
            return {
                name: fn?.name ?? tcRec.name,
                arguments: args,
            };
        }),
    );
}

function extractFingerprint(msg: {
    role: string;
    content?: string | Array<{ type: string; text?: string }>;
    tool_calls?: unknown[];
    toolCalls?: unknown[];
}): ResponseFingerprint | undefined {
    if (msg.role !== "assistant") return undefined;
    return {
        text: extractAssistantText(msg),
        toolCalls: extractToolCallsFingerprint(msg),
    };
}

/** Detect a loop from two consecutive assistant fingerprints.
 *  Same tool calls = definite loop. No tool calls = fall back to text duplicate. */
function isLoop(
    a: ResponseFingerprint | undefined,
    b: ResponseFingerprint | undefined,
): boolean {
    if (!a || !b) return false;
    if (a.toolCalls && b.toolCalls && a.toolCalls === b.toolCalls) return true;
    if (!a.toolCalls && !b.toolCalls && a.text && b.text) {
        return a.text.trim().toLowerCase() === b.text.trim().toLowerCase();
    }
    return false;
}

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

function notifySafely(
    ctx: ExtensionContext,
    message: string,
    type: "info" | "warning" | "error",
): void {
    try {
        ctx.ui.notify(message, type);
    } catch (e) {
        console.error("[pi-bump] Failed to show notification:", e);
    }
}

/** Send a continue — invisible by default, visible if escalation is needed. */
function sendContinue(
    pi: ExtensionAPI,
    sessionId: string,
    needsEscalation: Set<string>,
): void {
    if (needsEscalation.has(sessionId)) {
        // Escalated: send visible user message with randomized nudge
        try {
            pi.sendUserMessage(pickNudge());
        } catch (e) {
            console.error("[pi-bump] Failed to send visible continue:", e);
        }
        return;
    }
    // Normal: invisible continue
    try {
        pi.sendMessage(
            {
                customType: CONTINUE_CUSTOM_TYPE,
                content: "",
                display: false,
                details: {},
            },
            { triggerTurn: true },
        );
    } catch (e) {
        console.error("[pi-bump] Failed to send invisible continue:", e);
    }
}

async function runContinueCommand(
    pi: ExtensionAPI,
    ctx: ExtensionCommandContext,
    args: string,
    needsEscalation: Set<string>,
): Promise<void> {
    const subcommand = args.trim().toLowerCase();

    // ---- subcommand: status -------------------------------------------------
    if (subcommand === "status") {
        const idle = ctx.isIdle();
        const hasPending = ctx.hasPendingMessages();
        const escalated = needsEscalation.has(ctx.sessionManager.getSessionId());
        notifySafely(
            ctx,
            [
                "pi-bump status:",
                `  Agent idle: ${idle ? "yes" : "no"}`,
                `  Pending messages: ${hasPending ? "yes" : "no"}`,
                `  Escalated: ${escalated ? "yes" : "no"}`,
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
                "When the agent loops, the next continue sends a visible nudge instead.",
            ].join("\n"),
            "info",
        );
        return;
    }

    // ---- main: fire continue (invisible or escalated visible) ---------------
    if (!ctx.isIdle()) {
        await ctx.waitForIdle();
    }

    const sessionId = ctx.sessionManager.getSessionId();
    sendContinue(pi, sessionId, needsEscalation);
}

/**
 * Pi extension that invisibly continues the agentic loop when the user
 * double-taps Enter on an empty chat input, or when the /continue command
 * is used.
 *
 * Strategy (hybrid escalation):
 *   - Double-tap Enter or /continue sends a custom-type message with display: false
 *   - context event replaces the invisible message with a minimal user signal ("Continue")
 *   - LLM sees the minimal signal and continues meaningfully instead of repeating
 *   - Loop detection (same tool calls or exact text duplicate) escalates the *next*
 *     continue to a visible randomized user message (e.g. "What's next?")
 *   - Real user input resets escalation and fingerprint state
 */
export default function bumpExtension(pi: ExtensionAPI) {
    // @ts-expect-error — monorepo type resolution mismatch (local 0.74.1 vs root 0.75.4)
    const sub = manageSessionSubscription(pi);
    const debugSessions = new Set<string>();

    // Per-session state for loop detection and escalation
    const lastFingerprints = new Map<
        string,
        [ResponseFingerprint | undefined, ResponseFingerprint | undefined]
    >();
    const needsEscalation = new Set<string>();

    pi.registerCommand("continue", {
        description: CONTINUE_COMMAND_DESCRIPTION,
        handler: async (args, ctx) => {
            await runContinueCommand(pi, ctx, args, needsEscalation);
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
                        `Debug mode ON — monitored: ${DEBUG_KEYS.join(", ")}`,
                        "info",
                    );
                }
            },
        });
    }

    // Reset state when the user sends real input.
    // Synchronous (not async) to avoid microtask deferral — a race with
    // a rapid assistant response could compare against the old fingerprint
    // and trigger false escalation.
    pi.on("input", (event, ctx) => {
        if (event.source === "interactive") {
            const sessionId = ctx.sessionManager.getSessionId();
            lastFingerprints.set(sessionId, [undefined, undefined]);
            needsEscalation.delete(sessionId);
        }
    });

    // Capture assistant messages to detect loops and manage escalation.
    pi.on("message_end", (event, ctx) => {
        const msg = event.message as {
            role: string;
            content?: string | Array<{ type: string; text?: string }>;
            tool_calls?: unknown[];
            toolCalls?: unknown[];
        };
        if (msg.role !== "assistant") return;
        const fingerprint = extractFingerprint(msg);
        if (!fingerprint) {
            if (process.env.BUMP_DEBUG === "1") {
                console.warn(
                    "[pi-bump] Could not extract fingerprint from assistant message. Tool-call loop detection may not fire.",
                );
            }
            return;
        }

        const sessionId = ctx.sessionManager.getSessionId();
        const [, last] = lastFingerprints.get(sessionId) ?? [
            undefined,
            undefined,
        ];

        if (isLoop(last, fingerprint)) {
            needsEscalation.add(sessionId);
        } else {
            needsEscalation.delete(sessionId);
        }

        lastFingerprints.set(sessionId, [last, fingerprint]);
    });

    // Replace invisible continue markers with minimal LLM signal.
    // Performance: scan with .some() first, only allocate a new array if an
    // invisible marker is found. In the 99% case (no invisible messages), no
    // array is created and no O(n) copy occurs — eliminating event-loop blocking
    // on long conversations.
    // @ts-expect-error — monorepo type resolution mismatch (local 0.74.1 vs root 0.75.4)
    pi.on("context", (event) => {
        const messages = (
            event as {
                messages: Array<{
                    role: string;
                    customType?: string;
                    content?: string;
                    timestamp?: number;
                }>;
            }
        ).messages;

        // Fast path: scan first, allocate only if needed.
        const hasInvisible = messages.some(
            (msg) =>
                msg.role === "custom" &&
                msg.customType === CONTINUE_CUSTOM_TYPE,
        );
        if (!hasInvisible) {
            return;
        }

        const modified = messages.map((msg) => {
            if (
                msg.role === "custom" &&
                msg.customType === CONTINUE_CUSTOM_TYPE
            ) {
                // Replace with a minimal user message — visible to LLM, invisible to user
                return {
                    role: "user",
                    content: CONTINUE_SIGNAL,
                    timestamp: Date.now(),
                };
            }
            return msg;
        });
        return { messages: modified };
    });

    // Clean up per-session state when a session shuts down.
    // All per-session collections are purged to prevent unbounded growth
    // across many sessions (especially debugSessions, which leaked prior to
    // this cleanup).
    pi.on("session_shutdown", (_event, ctx) => {
        const sessionId = ctx.sessionManager.getSessionId();
        lastFingerprints.delete(sessionId);
        needsEscalation.delete(sessionId);
        debugSessions.delete(sessionId);
    });

    pi.on("session_start", (_event, ctx) => {
        if (!ctx.hasUI) return;

        const sessionId = ctx.sessionManager.getSessionId();
        let lastKeyId: string | undefined;
        let lastKeyTime = 0;

        sub.set(
            // Double-tap state machine for terminal input.
            //
            // State: lastKeyId + lastKeyTime track the most recent monitored key.
            // A second press of the same key within THRESHOLD_MS (300ms) counts
            // as a double-tap.
            //
            // Only Enter double-taps are consumed ({ consume: true }). All other
            // monitored keys (backspace, delete, ctrl+enter, alt+enter) pass
            // through to the terminal — they are only tracked in debug mode.
            ctx.ui.onTerminalInput((data) => {
                // Performance: check editor text BEFORE key matching. When the user
                // is typing, only Enter matters; skip expensive matchesKey() calls
                // for backspace/delete. In normal mode only Key.enter is checked,
                // reducing matchesKey() calls by 80% per keystroke.
                const editorText = ctx.ui.getEditorText().trim();
                const isDebug = debugSessions.has(sessionId);
                const keysToCheck = isDebug
                    ? DEBUG_KEYS
                    : [Key.enter];

                const keyId = keysToCheck.find((keyId) => matchesKey(data, keyId));
                if (!keyId) return;

                // Enter with text in editor is a normal submit, not a continue.
                if (keyId === Key.enter && editorText.length > 0) return;

                const now = Date.now();

                // Reset stale single-tap state — a tap older than THRESHOLD_MS
                // is no longer part of a potential double-tap sequence.
                if (lastKeyId && now - lastKeyTime >= THRESHOLD_MS) {
                    lastKeyId = undefined;
                    lastKeyTime = 0;
                }

                if (keyId === lastKeyId && now - lastKeyTime < THRESHOLD_MS) {
                    const duration = now - lastKeyTime;
                    lastKeyId = undefined;
                    lastKeyTime = 0;

                    // Only Enter + idle + no pending → actually send a continue.
                    // All other double-taps (backspace, delete, etc.) fall through
                    // without consumption so the terminal processes them normally.
                    if (keyId === Key.enter && ctx.isIdle() && !ctx.hasPendingMessages()) {
                        sendContinue(pi, sessionId, needsEscalation);
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
                    }
                    // Explicit return prevents falling through to lastKeyId = keyId,
                    // which would corrupt the single-tap state machine.
                    return;
                }

                lastKeyId = keyId;
                lastKeyTime = now;
            }),
        );
    });
}

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
//
// Manual integration test for @alexleekt/pi-bump.
// Simulates the ExtensionAPI and ExtensionContext to verify double-Enter logic.
// Run: node test-integration.mjs

import bumpExtension, { NUDGE_MESSAGES } from "./index.ts";

let sentMessages = [];
let sentUserMessages = [];
let editorText = "";
let idle = true;
let hasPending = false;
let terminalHandler = null;
let inputHandler = null;
let messageEndHandler = null;
let notifications = [];
const commandHandlers = {};
let contextHandler = null;
let sessionShutdownHandler = null;

const mockUI = {
    onTerminalInput: (handler) => {
        terminalHandler = handler;
        return () => {
            terminalHandler = null;
        };
    },
    getEditorText: () => editorText,
    notify: (message, type) => {
        notifications.push({ message, type });
    },
};

const sessionId = "test-session";

const mockCtx = {
    hasUI: true,
    ui: mockUI,
    isIdle: () => idle,
    hasPendingMessages: () => hasPending,
    sessionManager: { getSessionId: () => sessionId },
};

const mockAPI = {
    on: (event, handler) => {
        if (event === "session_start") {
            handler({}, mockCtx);
        } else if (event === "input") {
            inputHandler = handler;
        } else if (event === "message_end") {
            messageEndHandler = handler;
        } else if (event === "context") {
            contextHandler = handler;
        } else if (event === "session_shutdown") {
            sessionShutdownHandler = handler;
        }
    },
    registerCommand: (name, config) => {
        commandHandlers[name] = config.handler;
    },
    sendMessage: (message, options) => {
        sentMessages.push({ message, options });
    },
    sendUserMessage: (content, options) => {
        sentUserMessages.push({ content, options });
    },
};

// Load extension — wires up handlers
bumpExtension(mockAPI);

function reset() {
    sentMessages = [];
    sentUserMessages = [];
    notifications = [];
    editorText = "";
    idle = true;
    hasPending = false;
    // Reset extension per-session state to prevent cross-test contamination
    if (inputHandler) {
        inputHandler({ source: "interactive", text: "reset" }, mockCtx);
    }
}

function simulateAssistantResponse(content, toolCalls) {
    if (messageEndHandler) {
        messageEndHandler(
            {
                message: {
                    role: "assistant",
                    content,
                    tool_calls: toolCalls ?? undefined,
                },
            },
            mockCtx,
        );
    }
}

function simulateUserInput(text) {
    if (inputHandler) {
        inputHandler({ source: "interactive", text }, mockCtx);
    }
}

function assertInvisible(name, check) {
    check(
        name,
        sentMessages.length === 1 &&
            sentMessages[0].message.customType === "__invisible_continue",
    );
}

function assertNudge(name, check) {
    check(
        name,
        sentUserMessages.length === 1 &&
            NUDGE_MESSAGES.includes(sentUserMessages[0].content),
    );
}

async function runTests() {
    let pass = 0;
    let fail = 0;

    function check(name, condition) {
        if (condition) {
            pass++;
            console.log(`  ✅ ${name}`);
        } else {
            fail++;
            console.log(`  ❌ ${name}`);
        }
    }

    if (!terminalHandler) {
        console.log("❌ Extension did not register a terminal input handler");
        return;
    }

    // Test 1: Double Enter on empty editor sends invisible message when idle
    {
        reset();
        console.log(
            "\nTest 1: Double Enter on empty editor (idle) — invisible tier",
        );
        const result1 = terminalHandler("\r");
        const result2 = terminalHandler("\r");
        check("First Enter NOT consumed", !result1?.consume);
        check("Second Enter consumed", result2?.consume === true);
        check(
            "Invisible message sent",
            sentMessages.length === 1 &&
                sentMessages[0].message.customType === "__invisible_continue",
        );
        check("No visible nudge sent", sentUserMessages.length === 0);
    }

    // Test 2: Double Enter ignored when not idle
    reset();
    idle = false;
    console.log("\nTest 2: Double Enter while streaming (not idle)");
    terminalHandler("\r");
    terminalHandler("\r");
    check(
        "No invisible message sent while streaming",
        sentMessages.length === 0,
    );
    check(
        "No visible nudge sent while streaming",
        sentUserMessages.length === 0,
    );

    // Test 3: Double Enter ignored when pending messages exist
    reset();
    hasPending = true;
    console.log("\nTest 3: Double Enter with pending messages");
    terminalHandler("\r");
    terminalHandler("\r");
    check(
        "No invisible message sent when pending messages exist",
        sentMessages.length === 0,
    );
    check(
        "No visible nudge sent when pending messages exist",
        sentUserMessages.length === 0,
    );

    // Test 4: Enter with text in editor is ignored
    reset();
    editorText = "some text";
    console.log("\nTest 4: Enter with text in editor");
    const r1 = terminalHandler("\r");
    const r2 = terminalHandler("\r");
    check("No message sent when editor has text", sentMessages.length === 0);
    check(
        "Input not consumed when editor has text",
        !r1?.consume && !r2?.consume,
    );

    // Test 5: Single Enter on empty editor does not send message
    reset();
    console.log("\nTest 5: Single Enter on empty editor");
    terminalHandler("\r");
    check("No message after single Enter", sentMessages.length === 0);

    // Test 6: Slow second Enter (>300ms) does not trigger
    {
        reset();
        console.log("\nTest 6: Slow second Enter (>300ms threshold)");
        terminalHandler("\r");
        const beforeCount = sentMessages.length;
        await new Promise((r) => setTimeout(r, 350));
        terminalHandler("\r");
        check(
            "No message after slow second Enter",
            sentMessages.length === beforeCount,
        );
    }
    reset();
    console.log("\nTest 7: Escalation after looped assistant responses");
    // First continue: invisible
    terminalHandler("\r");
    terminalHandler("\r");
    assertInvisible("First double-tap sends invisible", check);

    // Simulate two identical assistant responses (loop)
    simulateAssistantResponse("I'll continue working on that.");
    simulateAssistantResponse("I'll continue working on that.");

    // Next continue: should escalate to visible
    sentMessages = [];
    terminalHandler("\r");
    terminalHandler("\r");
    assertNudge("Escalated double-tap sends visible nudge", check);
    check("No invisible message when escalated", sentMessages.length === 0);
    reset();
    console.log("\nTest 8: Escalation cleared after non-loop response");
    // Trigger loop and escalation
    terminalHandler("\r");
    terminalHandler("\r");
    simulateAssistantResponse("I'll continue working on that.");
    simulateAssistantResponse("I'll continue working on that.");

    // Non-loop response clears escalation
    simulateAssistantResponse("Here's the updated file.");

    sentMessages = [];
    sentUserMessages = [];
    terminalHandler("\r");
    terminalHandler("\r");
    assertInvisible("After non-loop response, goes back to invisible", check);
    check("No visible nudge after reset", sentUserMessages.length === 0);
    reset();
    console.log("\nTest 9: Real user input resets escalation");
    // Trigger loop and escalation
    terminalHandler("\r");
    terminalHandler("\r");
    simulateAssistantResponse("I'll continue working on that.");
    simulateAssistantResponse("I'll continue working on that.");

    // Real user input resets
    simulateUserInput("Please fix the bug");

    sentMessages = [];
    sentUserMessages = [];
    terminalHandler("\r");
    terminalHandler("\r");
    assertInvisible("After real input, goes back to invisible", check);
    check("No visible nudge after real input", sentUserMessages.length === 0);
    reset();
    console.log("\nTest 10: Tool-call loop triggers escalation");
    terminalHandler("\r");
    terminalHandler("\r");
    simulateAssistantResponse(null, [
        { function: { name: "read", arguments: '{"path":"a.txt"}' } },
    ]);
    simulateAssistantResponse(null, [
        { function: { name: "read", arguments: '{"path":"a.txt"}' } },
    ]);

    sentMessages = [];
    sentUserMessages = [];
    terminalHandler("\r");
    terminalHandler("\r");
    assertNudge("Tool-call loop escalates to visible nudge", check);
    check(
        "No invisible message when tool-loop escalated",
        sentMessages.length === 0,
    );
    reset();
    console.log("\nTest 11: Non-loop tool calls stay invisible");
    terminalHandler("\r");
    terminalHandler("\r");
    simulateAssistantResponse(null, [
        { function: { name: "read", arguments: '{"path":"a.txt"}' } },
    ]);
    simulateAssistantResponse(null, [
        { function: { name: "write", arguments: '{"path":"b.txt"}' } },
    ]);

    sentMessages = [];
    sentUserMessages = [];
    terminalHandler("\r");
    terminalHandler("\r");
    assertInvisible("Different tool calls stay on invisible tier", check);
    check("No visible nudge when tools differ", sentUserMessages.length === 0);

    // Test 12: Double backspace NOT consumed (passes through to terminal)
    {
        reset();
        console.log(
            "\nTest 12: Double backspace passes through (not consumed)",
        );
        const r1 = terminalHandler("\b");
        const r2 = terminalHandler("\b");
        check("First backspace NOT consumed", !r1?.consume);
        check("Second backspace NOT consumed", !r2?.consume);
        check(
            "No message sent for backspace double-tap",
            sentMessages.length === 0,
        );
        check("No visible nudge for backspace", sentUserMessages.length === 0);
    }

    // Test 13: Double delete NOT consumed (passes through to terminal)
    {
        reset();
        console.log("\nTest 13: Double delete passes through (not consumed)");
        const r1 = terminalHandler("\x7F");
        const r2 = terminalHandler("\x7F");
        check("First delete NOT consumed", !r1?.consume);
        check("Second delete NOT consumed", !r2?.consume);
        check(
            "No message sent for delete double-tap",
            sentMessages.length === 0,
        );
    }

    // Test 14: Mixed backspace-enter double-tap does not cross-contaminate
    {
        reset();
        console.log("\nTest 14: Backspace then Enter — no cross-contamination");
        // Allow any stale lastKeyId state to expire before testing.
        // In the optimized code backspace is no longer monitored, so a
        // stale "enter" left by earlier tests would otherwise falsely
        // match as a double-tap within the 300ms window.
        await new Promise((r) => setTimeout(r, 350));
        terminalHandler("\b"); // backspace is not monitored in normal mode
        const r2 = terminalHandler("\r"); // enter should be a single tap
        check("Enter after backspace NOT consumed", !r2?.consume);
        check("No message for mixed keys", sentMessages.length === 0);
    }

    // Test 15: Context handler replaces invisible continue markers
    {
        reset();
        console.log("\nTest 15: Context handler strips invisible markers");
        const messages = [
            { role: "user", content: "Hello", timestamp: 1 },
            {
                role: "custom",
                customType: "__invisible_continue",
                content: "",
                timestamp: 2,
            },
            { role: "assistant", content: "Hi", timestamp: 3 },
        ];
        const result = contextHandler({ messages });
        check(
            "Context handler returns modified messages",
            result && Array.isArray(result.messages),
        );
        check(
            "Invisible marker replaced with user Continue",
            result.messages.some(
                (m) => m.role === "user" && m.content === "Continue",
            ),
        );
        check(
            "Original custom message removed",
            !result.messages.some(
                (m) =>
                    m.role === "custom" &&
                    m.customType === "__invisible_continue",
            ),
        );
    }

    // Test 16: Context handler is no-op when no invisible markers
    {
        reset();
        console.log("\nTest 16: Context handler no-op without markers");
        const messages = [
            { role: "user", content: "Hello", timestamp: 1 },
            { role: "assistant", content: "Hi", timestamp: 2 },
        ];
        const result = contextHandler({ messages });
        check(
            "No modification when no invisible markers",
            result === undefined,
        );
    }
    reset();
    console.log("\nTest 17: /continue command fires invisible tier");
    await commandHandlers.continue("", mockCtx);
    assertInvisible("/continue sends invisible message", check);
    check("No visible nudge from /continue", sentUserMessages.length === 0);
    reset();
    console.log("\nTest 18: /continue blocked when pending messages");
    hasPending = true;
    await commandHandlers.continue("", mockCtx);
    check("/continue blocked when pending", sentMessages.length === 0);
    check(
        "Notification sent for blocked continue",
        notifications.some((n) => n.message.includes("Cannot continue")),
    );
    hasPending = false;
    reset();
    console.log("\nTest 19: Unknown /continue subcommand shows warning");
    await commandHandlers.continue("foobar", mockCtx);
    check("No message sent for unknown subcommand", sentMessages.length === 0);
    check(
        "Warning notification for unknown subcommand",
        notifications.some(
            (n) =>
                n.type === "warning" &&
                n.message.includes("Unknown subcommand"),
        ),
    );
    reset();
    console.log("\nTest 20: /continue status shows diagnostics");
    await commandHandlers.continue("status", mockCtx);
    check(
        "Status notification sent",
        notifications.some((n) => n.message.includes("pi-bump status:")),
    );
    reset();
    console.log("\nTest 21: /continue help shows help text");
    await commandHandlers.continue("help", mockCtx);
    check(
        "Help notification sent",
        notifications.some((n) => n.message.includes("/continue status")),
    );
    reset();
    console.log("\nTest 22: Session shutdown cleans up state");
    // Trigger escalation
    terminalHandler("\r");
    terminalHandler("\r");
    simulateAssistantResponse("I'll continue working on that.");
    simulateAssistantResponse("I'll continue working on that.");
    // Simulate shutdown
    if (sessionShutdownHandler) {
        sessionShutdownHandler({}, mockCtx);
    }
    // After shutdown, next double-tap goes invisible
    sentMessages = [];
    sentUserMessages = [];
    terminalHandler("\r");
    terminalHandler("\r");
    assertInvisible("After shutdown, back to invisible tier", check);
    check(
        "No visible nudge after shutdown cleanup",
        sentUserMessages.length === 0,
    );
    reset();
    console.log("\nTest 23: Empty assistant responses trigger loop detection");
    terminalHandler("\r");
    terminalHandler("\r");
    simulateAssistantResponse(null);
    simulateAssistantResponse(null);

    sentMessages = [];
    sentUserMessages = [];
    terminalHandler("\r");
    terminalHandler("\r");
    assertNudge("Empty responses escalate to visible nudge", check);
    check(
        "No invisible message for empty-loop escalation",
        sentMessages.length === 0,
    );
    reset();
    console.log("\nTest 24: /continue command escalates after loop");
    // First /continue: invisible
    await commandHandlers.continue("", mockCtx);
    check("First /continue sends invisible", sentMessages.length === 1);

    // Simulate two identical assistant responses (loop)
    simulateAssistantResponse("I'll continue working on that.");
    simulateAssistantResponse("I'll continue working on that.");

    // Next /continue: should escalate to visible
    sentMessages = [];
    sentUserMessages = [];
    await commandHandlers.continue("", mockCtx);
    assertNudge("Escalated /continue sends visible nudge", check);
    check("No invisible message when escalated", sentMessages.length === 0);

    console.log(`\n${pass} passed, ${fail} failed`);
}

runTests().catch((e) => {
    console.error("Test runner failed:", e);
    process.exit(1);
});

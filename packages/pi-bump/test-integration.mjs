// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
//
// Manual integration test for @alexleekt/pi-bump.
// Simulates the ExtensionAPI and ExtensionContext to verify double-Enter logic.
// Run: node test-integration.mjs

import bumpExtension from "./index.ts";

let sentMessages = [];
let sentUserMessages = [];
let editorText = "";
let idle = true;
let hasPending = false;
let terminalHandler = null;
let inputHandler = null;
let messageEndHandler = null;

const mockUI = {
    onTerminalInput: (handler) => {
        terminalHandler = handler;
        return () => {
            terminalHandler = null;
        };
    },
    getEditorText: () => editorText,
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
        }
    },
    registerCommand: () => {},
    sendMessage: (message, options) => {
        sentMessages.push({ message, options, at: Date.now() });
    },
    sendUserMessage: (content, options) => {
        sentUserMessages.push({ content, options, at: Date.now() });
    },
};

// Load extension — wires up handlers
bumpExtension(mockAPI);

function reset() {
    sentMessages = [];
    sentUserMessages = [];
    editorText = "";
    idle = true;
    hasPending = false;
}

function simulateAssistantResponse(content, toolCalls) {
    if (messageEndHandler) {
        messageEndHandler(
            { message: { role: "assistant", content, tool_calls: toolCalls } },
            mockCtx,
        );
    }
}

function simulateUserInput(text) {
    if (inputHandler) {
        inputHandler({ source: "interactive", text }, mockCtx);
    }
}

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

function isNudge(content) {
    return NUDGE_MESSAGES.includes(content);
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
        console.log("\nTest 1: Double Enter on empty editor (idle) — invisible tier");
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
    check("No invisible message sent while streaming", sentMessages.length === 0);
    check("No visible nudge sent while streaming", sentUserMessages.length === 0);

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

    // Test 7: Escalation — after looped responses, next continue sends visible nudge
    {
        reset();
        console.log("\nTest 7: Escalation after looped assistant responses");
        // First continue: invisible
        terminalHandler("\r");
        terminalHandler("\r");
        check("First double-tap sends invisible", sentMessages.length === 1);

        // Simulate two identical assistant responses (loop)
        simulateAssistantResponse("I'll continue working on that.");
        simulateAssistantResponse("I'll continue working on that.");

        // Next continue: should escalate to visible
        sentMessages = [];
        terminalHandler("\r");
        terminalHandler("\r");
        check(
            "Escalated double-tap sends visible nudge",
            sentUserMessages.length === 1 && isNudge(sentUserMessages[0].content),
        );
        check("No invisible message when escalated", sentMessages.length === 0);
    }

    // Test 8: Escalation cleared after non-loop response
    {
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
        check(
            "After non-loop response, goes back to invisible",
            sentMessages.length === 1 &&
                sentMessages[0].message.customType === "__invisible_continue",
        );
        check("No visible nudge after reset", sentUserMessages.length === 0);
    }

    // Test 9: Real user input resets escalation
    {
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
        check(
            "After real input, goes back to invisible",
            sentMessages.length === 1 &&
                sentMessages[0].message.customType === "__invisible_continue",
        );
        check("No visible nudge after real input", sentUserMessages.length === 0);
    }

    // Test 10: Tool-call loop triggers escalation
    {
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
        check(
            "Tool-call loop escalates to visible nudge",
            sentUserMessages.length === 1 && isNudge(sentUserMessages[0].content),
        );
        check("No invisible message when tool-loop escalated", sentMessages.length === 0);
    }

    // Test 11: Non-loop tool calls do not escalate
    {
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
        check(
            "Different tool calls stay on invisible tier",
            sentMessages.length === 1 &&
                sentMessages[0].message.customType === "__invisible_continue",
        );
        check("No visible nudge when tools differ", sentUserMessages.length === 0);
    }

    // Test 12: Double backspace NOT consumed (passes through to terminal)
    {
        reset();
        console.log("\nTest 12: Double backspace passes through (not consumed)");
        const r1 = terminalHandler("\b");
        const r2 = terminalHandler("\b");
        check("First backspace NOT consumed", !r1?.consume);
        check("Second backspace NOT consumed", !r2?.consume);
        check("No message sent for backspace double-tap", sentMessages.length === 0);
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
        check("No message sent for delete double-tap", sentMessages.length === 0);
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

    console.log(`\n${pass} passed, ${fail} failed`);
}

runTests().catch((e) => { console.error("Test runner failed:", e); process.exit(1); });

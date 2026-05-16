// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
//
// Manual integration test for @alexleekt/pi-bump.
// Simulates the ExtensionAPI and ExtensionContext to verify double-Enter logic.
// Run: node test-integration.mjs

import bumpExtension from "./index.ts";

let sentMessages = [];
let editorText = "";
let idle = true;
let hasPending = false;
let terminalHandler = null;

const mockUI = {
    onTerminalInput: (handler) => {
        terminalHandler = handler;
        return () => {
            terminalHandler = null;
        };
    },
    getEditorText: () => editorText,
};

const mockCtx = {
    hasUI: true,
    ui: mockUI,
    isIdle: () => idle,
    hasPendingMessages: () => hasPending,
};

const mockAPI = {
    on: (event, handler) => {
        if (event === "session_start") {
            handler({}, mockCtx);
        }
    },
    sendUserMessage: (content, options) => {
        sentMessages.push({ content, options, at: Date.now() });
    },
};

// Load extension — wires up the session_start handler and captures terminalHandler
bumpExtension(mockAPI);

function reset() {
    sentMessages = [];
    editorText = "";
    idle = true;
    hasPending = false;
}

const NUDGE_MESSAGES = [
    "Continue",
    "Keep going",
    "What's next?",
    "Onward!",
    "And then?",
    "More please",
    "Next step?",
    "Keep the momentum",
    "Let's see it",
    "Proceed",
    "Go on",
    "Carry on",
    "Move forward",
    "Keep at it",
    "Press on",
];

function isNudge(content) {
    return NUDGE_MESSAGES.includes(content);
}

function runTests() {
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

    // Test 1: Double Enter on empty editor sends a nudge when idle
    {
        reset();
        console.log("\nTest 1: Double Enter on empty editor (idle)");
        const result1 = terminalHandler("\r");
        const result2 = terminalHandler("\r");
        check("First Enter NOT consumed", !result1?.consume);
        check("Second Enter consumed", result2?.consume === true);
        check(
            "Message sent is a nudge",
            sentMessages.length === 1 && isNudge(sentMessages[0].content),
        );
    }

    // Test 2: Double Enter ignored when not idle
    reset();
    idle = false;
    console.log("\nTest 2: Double Enter while streaming (not idle)");
    terminalHandler("\r");
    terminalHandler("\r");
    check("No message sent while streaming", sentMessages.length === 0);

    // Test 3: Double Enter ignored when pending messages exist
    reset();
    hasPending = true;
    console.log("\nTest 3: Double Enter with pending messages");
    terminalHandler("\r");
    terminalHandler("\r");
    check(
        "No message sent when pending messages exist",
        sentMessages.length === 0,
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
        const start = Date.now();
        while (Date.now() - start < 350) {
            // busy-wait 350ms
        }
        terminalHandler("\r");
        check(
            "No message after slow second Enter",
            sentMessages.length === beforeCount,
        );
    }

    console.log(`\n${pass} passed, ${fail} failed`);
}

runTests();

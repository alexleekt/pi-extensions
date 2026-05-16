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

// Load extension — this wires up the session_start handler and captures terminalHandler
bumpExtension(mockAPI);

function reset() {
    sentMessages = [];
    editorText = "";
    idle = true;
    hasPending = false;
}

function assert(name, condition) {
    if (condition) {
        console.log(`  ✅ ${name}`);
        return [1, 0];
    } else {
        console.log(`  ❌ ${name}`);
        return [0, 1];
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

function runTests() {
    let pass = 0;
    let fail = 0;
    let p, f;

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
        [p, f] = assert(
            "First Enter NOT consumed",
            result1 === undefined || !result1?.consume,
        );
        pass += p; fail += f;
        [p, f] = assert("Second Enter consumed", result2?.consume === true);
        pass += p; fail += f;
        [p, f] = assert(
            "Message sent is a nudge",
            sentMessages.length === 1 && isNudge(sentMessages[0].content),
        );
        pass += p; fail += f;
    }

    // Test 2: Double Enter ignored when not idle
    {
        reset();
        idle = false;
        console.log("\nTest 2: Double Enter while streaming (not idle)");
        terminalHandler("\r");
        terminalHandler("\r");
        [p, f] = assert(
            "No message sent while streaming",
            sentMessages.length === 0,
        );
        pass += p; fail += f;
    }

    // Test 3: Double Enter ignored when pending messages exist
    {
        reset();
        hasPending = true;
        console.log("\nTest 3: Double Enter with pending messages");
        terminalHandler("\r");
        terminalHandler("\r");
        [p, f] = assert(
            "No message sent when pending messages exist",
            sentMessages.length === 0,
        );
        pass += p; fail += f;
    }

    // Test 4: Enter with text in editor is ignored
    {
        reset();
        editorText = "some text";
        console.log("\nTest 4: Enter with text in editor");
        const r1 = terminalHandler("\r");
        const r2 = terminalHandler("\r");
        [p, f] = assert(
            "No message sent when editor has text",
            sentMessages.length === 0,
        );
        pass += p; fail += f;
        [p, f] = assert(
            "Input not consumed when editor has text",
            (r1 === undefined || !r1?.consume) &&
                (r2 === undefined || !r2?.consume),
        );
        pass += p; fail += f;
    }

    // Test 5: Single Enter on empty editor does not send message
    {
        reset();
        console.log("\nTest 5: Single Enter on empty editor");
        terminalHandler("\r");
        [p, f] = assert(
            "No message after single Enter",
            sentMessages.length === 0,
        );
        pass += p; fail += f;
    }

    // Test 6: Slow second Enter (>300ms) does not trigger
    {
        reset();
        console.log("\nTest 6: Slow second Enter (>300ms threshold)");
        terminalHandler("\r");
        // Manually expire the threshold by resetting lastEmptyEnter
        // Since lastEmptyEnter is private, we simulate by waiting.
        // In the real code, the gap must be >= 300ms.
        // We force-expire by sending a non-Enter keystroke first (resets nothing),
        // then send a fresh first Enter, wait conceptually, then second.
        // Actually, the simplest way is: first Enter, wait, then the next Enter
        // should be treated as a new first Enter (not a double-tap).
        const beforeCount = sentMessages.length;
        // Simulate 400ms delay by directly manipulating the private state
        // isn't possible; instead we rely on the fact that the test runner
        // runs fast. We'll do a small timeout and check behavior.
        const start = Date.now();
        while (Date.now() - start < 350) {
            // busy-wait 350ms
        }
        terminalHandler("\r");
        [p, f] = assert(
            "No message after slow second Enter",
            sentMessages.length === beforeCount,
        );
        pass += p; fail += f;
    }

    console.log(`\n${pass} passed, ${fail} failed`);
}

runTests();

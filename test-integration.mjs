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
    hasPendingMessages: () => false,
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

function runTests() {
    let pass = 0;
    let fail = 0;

    if (!terminalHandler) {
        console.log("❌ Extension did not register a terminal input handler");
        return;
    }

    // Test 1: Double Enter on empty editor sends Bump when idle
    {
        reset();
        console.log("\nTest 1: Double Enter on empty editor (idle)");
        const result1 = terminalHandler("\r");
        const result2 = terminalHandler("\r");
        let [p, f] = assert(
            "First Enter NOT consumed",
            result1 === undefined || !result1?.consume,
        );
        pass += p;
        fail += f;
        [p, f] = assert("Second Enter consumed", result2?.consume === true);
        pass += p;
        fail += f;
        [p, f] = assert(
            "Message sent",
            sentMessages.length === 1 && sentMessages[0].content === "Bump",
        );
        pass += p;
        fail += f;
    }

    // Test 2: Double Enter ignored when not idle
    {
        reset();
        idle = false;
        console.log("\nTest 2: Double Enter while streaming (not idle)");
        terminalHandler("\r");
        terminalHandler("\r");
        const [p, f] = assert(
            "No message sent while streaming",
            sentMessages.length === 0,
        );
        pass += p;
        fail += f;
    }

    // Test 3: Enter with text in editor is ignored
    {
        reset();
        editorText = "some text";
        console.log("\nTest 3: Enter with text in editor");
        const r1 = terminalHandler("\r");
        const r2 = terminalHandler("\r");
        let [p, f] = assert(
            "No message sent when editor has text",
            sentMessages.length === 0,
        );
        pass += p;
        fail += f;
        [p, f] = assert(
            "Input not consumed when editor has text",
            (r1 === undefined || !r1?.consume) &&
                (r2 === undefined || !r2?.consume),
        );
        pass += p;
        fail += f;
    }

    // Test 4: Single Enter on empty editor does not send message
    {
        reset();
        console.log("\nTest 4: Single Enter on empty editor");
        terminalHandler("\r");
        const [p, f] = assert(
            "No message after single Enter",
            sentMessages.length === 0,
        );
        pass += p;
        fail += f;
    }

    console.log(`\n${pass} passed, ${fail} failed`);
}

runTests();

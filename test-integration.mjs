// Manual integration test for @alexleekt/pi-bump
// Simulates the ExtensionAPI and ExtensionContext to verify double-Enter logic.
// Run: node test-integration.mjs

import bumpExtension from "./index.ts";

let sentMessages = [];
let statusEntries = [];
let editorText = "";
let idle = true;
let terminalHandler = null;

const mockUI = {
  onTerminalInput: (handler) => {
    terminalHandler = handler;
    return () => { terminalHandler = null; };
  },
  setStatus: (key, text) => {
    statusEntries.push({ key, text, at: Date.now() });
  },
  getEditorText: () => editorText,
  notify: (msg, type) => {},
};

const mockCtx = {
  hasUI: true,
  ui: mockUI,
  isIdle: () => idle,
  cwd: "/tmp",
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
  statusEntries = [];
  editorText = "";
  idle = true;
}

function assert(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    return true;
  } else {
    console.log(`  ❌ ${name}`);
    return false;
  }
}

function runTests() {
  let pass = 0;
  let fail = 0;

  if (!terminalHandler) {
    console.log("❌ Extension did not register a terminal input handler");
    return;
  }

  // Test 1: Double Enter on empty editor sends Continue when idle
  {
    reset();
    console.log("\nTest 1: Double Enter on empty editor (idle)");
    terminalHandler("\r"); // first Enter
    const result2 = terminalHandler("\r"); // second Enter within threshold
    pass += assert("First Enter consumed", result2 === undefined || result2?.consume === true);
    pass += assert("Message sent", sentMessages.length === 1 && sentMessages[0].content === "Continue");
    pass += assert("Status flash set", statusEntries.some(s => s.key === "pi-bump" && s.text?.includes("Bumped")));
    fail += 3 - pass; // rough count
  }

  // Test 2: Double Enter ignored when not idle
  {
    reset();
    idle = false;
    console.log("\nTest 2: Double Enter while streaming (not idle)");
    terminalHandler("\r");
    terminalHandler("\r");
    pass += assert("No message sent while streaming", sentMessages.length === 0);
    fail += 1 - (sentMessages.length === 0 ? 1 : 0);
  }

  // Test 3: Enter with text in editor is ignored
  {
    reset();
    editorText = "some text";
    console.log("\nTest 3: Enter with text in editor");
    const r1 = terminalHandler("\r");
    const r2 = terminalHandler("\r");
    pass += assert("No message sent when editor has text", sentMessages.length === 0);
    pass += assert("Input not consumed when editor has text", (r1 === undefined || !r1?.consume) && (r2 === undefined || !r2?.consume));
    fail += 2 - (sentMessages.length === 0 ? 1 : 0) - ((r1 === undefined || !r1?.consume) && (r2 === undefined || !r2?.consume) ? 1 : 0);
  }

  // Test 4: Single Enter on empty editor does not send message
  {
    reset();
    console.log("\nTest 4: Single Enter on empty editor");
    terminalHandler("\r");
    pass += assert("No message after single Enter", sentMessages.length === 0);
    fail += 1 - (sentMessages.length === 0 ? 1 : 0);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
}

runTests();

# Code Review: `@alexleekt/pi-bump` v0.1.0

**Reviewer**: Senior Staff Engineer  
**Scope**: Full codebase (`index.ts`, `package.json`, `tsconfig.json`, `test-integration.mjs`, `README.md`, `AGENT.md`)  
**Date**: 2026-05-16  
**Overall Confidence**: Medium-High — core logic is correct, but documentation drift and test gaps need attention before broader adoption.

---

## Executive Summary

The extension does one thing well: detect a double-tap Enter on an empty editor and send a "Bump" message to the Pi agent. The implementation is concise, type-safe, and correctly guards against firing while streaming or when messages are pending.

**Blockers**: 0  
**Warnings**: 5  
**Suggestions**: 6

The most important fixes before publishing to GitHub/npm:
1. **Fix documentation drift** — `AGENT.md` describes behavior (status flash, first-Enter consumption) that the code does not implement.
2. **Reset per-session state** — `lastEmptyEnter` leaks across sessions and can cause phantom double-taps.
3. **Harden the test runner** — the pass/fail math is fragile and several code paths (slow second Enter, pending messages, re-entrant sessions) are untested.

---

## Findings

### [WARNING] State Leakage: `lastEmptyEnter` survives across sessions
- **File**: `index.ts` (line 4)
- **Problem**: The `lastEmptyEnter` timestamp is declared at module scope and is never reset when a session ends. If a user presses Enter once in session A, starts session B within 300 ms, and presses Enter again, session B may falsely trigger a double-tap.
- **Evidence**:
  ```typescript
  let lastEmptyEnter = 0; // module scope — never reset
  // session_shutdown handler only cleans up the listener:
  pi.on("session_shutdown", () => {
    unsubscribe?.();
    unsubscribe = null;
    // lastEmptyEnter is NOT reset here
  });
  ```
- **Impact**: Phantom "Bump" messages in rapid session transitions; violates the principle that session-local state should not leak.
- **Fix**: Reset `lastEmptyEnter = 0` inside the `session_shutdown` handler, or better, scope it inside the `session_start` closure so it is naturally garbage-collected.
  ```typescript
  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    let lastEmptyEnter = 0; // per-session
    // ... rest of handler
  });
  ```

---

### [WARNING] Memory Leak: `session_start` can overwrite an active listener
- **File**: `index.ts` (line 10)
- **Problem**: If `session_start` fires twice without an intervening `session_shutdown`, the first `unsubscribe` is overwritten and its listener becomes an orphan (memory leak).
- **Evidence**:
  ```typescript
  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    unsubscribe = ctx.ui.onTerminalInput((data) => { ... });
    // no guard: previous unsubscribe is silently dropped
  });
  ```
- **Impact**: Leaked listeners and closures accumulate if the host re-initializes sessions aggressively.
- **Fix**: Defensively unsubscribe before re-subscribing:
  ```typescript
  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    unsubscribe?.(); // clean up any stale listener
    unsubscribe = ctx.ui.onTerminalInput((data) => { ... });
  });
  ```

---

### [WARNING] Documentation Drift: `AGENT.md` claims status flash behavior that does not exist
- **File**: `AGENT.md` ("Architecture" section)
- **Problem**: `AGENT.md` states: "Shows a brief status flash via `ctx.ui.setStatus()` for 800 ms." The code never calls `setStatus` or `notify`. The test mocks `setStatus`, but it is unused by the implementation.
- **Evidence**:
  - `AGENT.md`: "6. Shows a brief status flash via `ctx.ui.setStatus()` for 800 ms."
  - `index.ts`: zero calls to `ctx.ui.setStatus()` or `ctx.ui.notify()`.
- **Impact**: Users and future maintainers expect visual feedback that will never appear. Test mocks give false confidence in dead code.
- **Fix**: Either implement the status flash (add `ctx.ui.setStatus()` + a timer) or remove the claim from `AGENT.md` and delete the unused mock from the test.

---

### [WARNING] Documentation Drift: `AGENT.md` contradicts code/README on first Enter consumption
- **File**: `AGENT.md` ("Architecture" section)
- **Problem**: `AGENT.md` says "First empty Enter is consumed to arm the detector." The code (and `README.md`) explicitly does **not** consume the first Enter — it returns `undefined` so other extensions and the terminal react normally.
- **Evidence**:
  - `AGENT.md`: "3. First empty Enter is consumed to arm the detector."
  - `index.ts` line 28: `return;` (no `consume: true`).
  - `README.md`: "Arms the detector on the first empty Enter (does not consume it, so the terminal and other extensions still react normally)."
- **Impact**: Confusing for anyone debugging input handling; the extension author and the code disagree.
- **Fix**: Update `AGENT.md` to match the actual behavior (first Enter passes through, second is consumed).

---

### [WARNING] Test Runner: Fragile pass/fail counting logic
- **File**: `test-integration.mjs` (Test 1 block)
- **Problem**: The first test block computes `fail` with `fail += 3 - pass`, which only works if exactly three assertions run and they execute in order. Adding, removing, or reordering assertions silently breaks the math.
- **Evidence**:
  ```javascript
  pass += assert("First Enter NOT consumed", ...);
  pass += assert("Second Enter consumed", ...);
  pass += assert("Message sent", ...);
  fail += 3 - pass; // rough count
  ```
- **Impact**: False positives/negatives in CI; the summary line becomes unreliable.
- **Fix**: Make `assert()` return a boolean and count deterministically:
  ```javascript
  function assert(name, condition) {
    const ok = !!condition;
    console.log(ok ? `  ✅ ${name}` : `  ❌ ${name}`);
    return ok ? [1, 0] : [0, 1];
  }
  // Then:
  const [p1, f1] = assert("First Enter NOT consumed", ...);
  pass += p1; fail += f1;
  ```

---

### [SUGGESTION] Missing npm metadata for GitHub publishing
- **File**: `package.json`
- **Problem**: The package lacks `repository`, `homepage`, and `bugs` fields, which GitHub and npm consumers expect.
- **Fix**:
  ```json
  {
    "repository": {
      "type": "git",
      "url": "https://github.com/alexleekt/pi-bump.git"
    },
    "homepage": "https://github.com/alexleekt/pi-bump#readme",
    "bugs": {
      "url": "https://github.com/alexleekt/pi-bump/issues"
    }
  }
  ```

---

### [SUGGESTION] Missing test coverage for threshold expiration
- **File**: `test-integration.mjs`
- **Problem**: No test verifies that a second Enter *after* 300 ms does NOT trigger a message. This is a core part of the "double-tap" contract.
- **Fix**: Add a test that injects a delay:
  ```javascript
  // Test: Slow second Enter is ignored
  {
    reset();
    console.log("\nTest: Slow second Enter (>300ms)");
    terminalHandler("\r");
    // simulate 400ms gap
    const oldLast = lastEmptyEnter; // if exposed, or use Date.now() mocking
    // ...assert no message sent
  }
  ```
  (May require making `lastEmptyEnter` injectable or mocking `Date.now`.)

---

### [SUGGESTION] Missing test coverage for `hasPendingMessages()` guard
- **File**: `test-integration.mjs`
- **Problem**: The mock always returns `false` for `hasPendingMessages()`. The code path that suppresses the bump when messages are queued is never exercised.
- **Fix**: Make `hasPendingMessages` configurable in the mock and add a test:
  ```javascript
  let hasPending = false;
  const mockCtx = {
    // ...
    hasPendingMessages: () => hasPending,
  };
  // Test: pending messages suppress bump
  {
    reset();
    hasPending = true;
    terminalHandler("\r");
    terminalHandler("\r");
    assert("No message when pending messages exist", sentMessages.length === 0);
  }
  ```

---

### [SUGGESTION] No `engines` field in package.json
- **File**: `package.json`
- **Problem**: No Node.js version requirement declared. Pi extensions are loaded by a host runtime; declaring compatibility reduces support issues.
- **Fix**:
  ```json
  "engines": {
    "node": ">=18.0.0"
  }
  ```

---

### [SUGGESTION] `.gitignore` is minimal and could be more defensive
- **File**: `.gitignore`
- **Problem**: Only ignores `node_modules/` and `package-lock.json`. Common artifacts (`.DS_Store`, `*.log`, `dist/`, `.env`) are not excluded.
- **Fix**:
  ```gitignore
  node_modules/
  package-lock.json
  .DS_Store
  *.log
  dist/
  .env
  .env.*
  ```

---

### [SUGGESTION] Unused mock methods in integration test
- **File**: `test-integration.mjs`
- **Problem**: `mockUI.setStatus`, `mockUI.notify`, and `mockCtx.cwd` are defined but never asserted or used by the extension.
- **Impact**: Dead code that may mislead future readers into thinking those features exist.
- **Fix**: Remove unused mocks, or implement the status flash and add assertions for it.

---

## Summary

| Severity | Count | Categories |
|----------|-------|------------|
| **CRITICAL** | 0 | — |
| **WARNING** | 5 | State leakage, memory leak, documentation drift (×2), test fragility |
| **SUGGESTION** | 6 | Metadata, coverage gaps, hygiene |

### Top 3 fixes to land before GitHub publish
1. **Reset `lastEmptyEnter` on session shutdown** (or scope it per-session) — eliminates cross-session phantom bumps.
2. **Align `AGENT.md` with reality** — remove the `setStatus` claim and correct the first-Enter consumption description.
3. **Harden the test runner** — fix the pass/fail math and add tests for threshold expiration + pending-messages guard.

The extension is functionally correct for the happy path. With the warnings above addressed, it is ready for public release.

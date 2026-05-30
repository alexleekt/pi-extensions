# Backend Tool Flow & Response Formatting Analysis

## Files Analyzed

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 616-618, 125-141 | Tool registration, `execute` -> `runAskUserWithTheme` -> `askUserHandler` |
| `tool/ask-user.ts` | 94-221 | `askUserHandler` — payload construction, `glimpseui.prompt()` call, error handling |
| `tool/response-formatter.ts` | 89-119 | `formatResponse` — normalizes raw result into `AgentToolResult` |
| `shared/ask-user.ts` | 1-44 | Shared types (`AskUserPayload`, `Question`, etc.) |
| `types/glimpseui.d.ts` | 1-52 | `glimpseui` API surface — `prompt()`, `GlimpseWindow`, `GlimpseWindowOptions` |
| `tool/__tests__/ask-user.test.ts` | 1-268 | Existing test coverage for signal, prompt errors, null results |
| `tool/__tests__/response-formatter.test.ts` | 1-168 | Tests for `formatResponse` branches |

---

## Findings

### 1. AbortSignal is Checked Once and Then Ignored — No Dialog Cancellation

**Location:** `tool/ask-user.ts` lines 100-117, 191-195

```ts
// Line 100: single check at entry
if (signal?.aborted) {
    return { content: [{ type: "text", text: "Cancelled" }], details: { ... } };
}

// Line 195: prompt() does NOT receive the signal
const rawResult = (await prompt(html, { ...windowOptions, timeout: 120000 })) as unknown;
```

**Root cause:** The `signal` parameter is only checked synchronously at the start of `askUserHandler`. If the parent aborts the signal **after** the check but **while** the dialog is open, there is no mechanism to:
- Cancel the `await prompt(...)` promise
- Close the Glimpse window
- Notify the webview that it should tear down

The `glimpseui.prompt()` API (`types/glimpseui.d.ts` lines 42-45) accepts only `html` and `GlimpseWindowOptions` — there is no `signal` or `abort` option. The `GlimpseWindow` interface (lines 18-30) exposes a `close()` method, but `prompt()` returns a `Promise<unknown | null>`, not a `GlimpseWindow` handle. Therefore, even if we wanted to call `close()` on abort, we have no window reference.

**Impact:** If the Pi framework aborts a tool call (e.g., user starts a new request, or a timeout fires at the framework level), the Glimpse dialog remains open on screen. The user may still interact with it, but the backend has already moved on. Any subsequent submission from the webview will either be dropped or cause an unexpected IPC message.

**Test coverage:** The existing test (`ask-user.test.ts` lines 210-224) verifies that `mockPrompt` is not called when the signal is already aborted. There is **no test** for a signal that aborts *after* `prompt()` has been invoked.

---

### 2. Timeout (`null` result) Returns `cancelled: true`, Which Pi Likely Treats as Normal Cancellation

**Location:** `tool/ask-user.ts` lines 195-198; `tool/response-formatter.ts` lines 89-99

```ts
// ask-user.ts
if (rawResult === null || ...__cancelled === true) {
    cancelled = true;
    result = null;
}

// response-formatter.ts
if (cancelled) {
    return {
        content: [{ type: "text", text: "Cancelled" }],
        details: { question, options, response: null, cancelled: true },
    };
}
```

**Root cause:** When `prompt()` returns `null` (which happens when the 120-second `timeout` expires, per `CHANGELOG.md` line 42), the tool returns `cancelled: true` with content text `"Cancelled"`. The Pi framework receives an `AgentToolResult` with `content` — this is a **normal successful tool result**, not an error/exception. The `details.cancelled` field is a metadata flag; the framework does not treat it as a failure that would trigger a retry or error handling path.

**Retry loop risk:** If the agent's system prompt or reasoning interprets `"Cancelled"` as "the user explicitly cancelled, do not ask again," then there is no loop. However, if the agent sees `"Cancelled"` and interprets it as "the dialog timed out, I should try again with a different approach," it could immediately invoke `ask_user` again. The tool itself does not implement any backoff, cooldown, or "already timed out once" tracking. Each call is independent.

**Test coverage:** `ask-user.test.ts` lines 55-63 verifies that `mockPrompt.mockResolvedValue(null)` yields `cancelled: true`. `response-formatter.test.ts` lines 147-156 tests the cancelled branch explicitly.

---

### 3. `result === null && cancelled === false` IS Reachable — Means "Unexpected Primitive Response"

**Location:** `tool/ask-user.ts` lines 188-205; `tool/response-formatter.ts` lines 101-110

```ts
// ask-user.ts
let result: Record<string, unknown> | null = null;  // line 188
let cancelled = false;                                // line 189

if (rawResult === null || ...) {                      // line 196
    cancelled = true;
    result = null;
} else if (typeof rawResult === "object" && rawResult !== null) { // line 199
    result = rawResult as Record<string, unknown>;
} else {
    // FALLTHROUGH: rawResult is a string, number, undefined, boolean, etc.
    // result stays null, cancelled stays false
}
```

```ts
// response-formatter.ts
if (!result) {
    return {
        content: [{ type: "text", text: "No response" }],
        details: { question, options, response: null, cancelled: false },
    };
}
```

**Root cause:** The `else if` at line 199 only handles `typeof rawResult === "object"`. If `prompt()` returns a primitive (`undefined`, `string`, `number`, `boolean`), `result` remains `null` and `cancelled` remains `false`. Then `formatResponse` returns `"No response"` with `cancelled: false`.

**Is it reachable?** `glimpseui.prompt()` is typed as `Promise<unknown | null>`. A well-behaved implementation should return either `null` or an object. However, there is no guarantee that it never returns `undefined` or another primitive due to a bug in the native host or IPC layer. The code does not defend against it.

**What it means for the agent:** The agent sees `"No response"` with `cancelled: false`. It may interpret this as "the user saw the dialog but submitted nothing," or it may be confused because there's no clear semantic difference between this and the empty-object case (which also produces `"No response"` — see `responseToText` line 55). The agent has no indication that the dialog timed out or was cancelled.

**Test coverage:** `response-formatter.test.ts` lines 158-166 tests this exact branch. `ask-user.test.ts` does NOT test a primitive `mockPrompt` return value.

---

### 4. Glimpse Error After Dialog Shown — Dialog Stays Open, Backend Returns Error

**Location:** `tool/ask-user.ts` lines 183-221

```ts
try {
    const baseHtml = resolveWebviewHtml();
    const html = baseHtml.replace("/*ASK_USER_PAYLOAD*/", ...);
    const rawResult = (await prompt(html, { ...windowOptions, timeout: 120000 })) as unknown;
    // ...
} catch (_err) {
    // ... returns "No UI available" immediately
    return { content: [...], details: { ... cancelled: true, error: "No UI available" } };
}
```

**Root cause:** The `try/catch` wraps the entire `prompt()` call. If `prompt()` throws **before** the dialog is created (e.g., Glimpse native host not found), the catch block is correct. However, if `prompt()` throws **after** the window is already shown (e.g., native host crash, IPC disconnect, or an internal error during the await), the catch block returns an error response to the Pi framework, but there is **no cleanup**:

- No call to `glimpseui` window `close()` (we don't have the handle anyway)
- No signal sent to the webview to self-destruct
- No `window.close()` or `ipcRenderer` teardown in the webview (the webview code is not in scope for this report, but the backend does not trigger any)

**Impact:** The dialog remains visible on screen. The user may continue interacting with it (selecting options, typing comments), but the backend has already concluded the tool call and returned an error. Any submission from the webview will be sent to a Glimpse native host that may no longer be listening, or it may orphan the window.

**Test coverage:** `ask-user.test.ts` lines 41-50 tests `mockPrompt.mockRejectedValue`, but the mock rejection happens synchronously before the dialog is conceptually shown. It does not simulate a mid-dialog crash.

---

### 5. No Signal Listener and No Cleanup — Dialog is Fire-and-Forget

**Location:** `tool/ask-user.ts` lines 100-221

**Root cause:** There is no `signal.addEventListener("abort", ...)` anywhere in the backend code. The `AbortSignal` is treated as a one-time gate, not a lifecycle event. The `glimpseui.prompt()` API does not support cancellation or signals. The only timeout mechanism is the 120-second `timeout: 120000` option passed to `prompt()`.

**What happens if signal aborts mid-prompt:**
1. `signal` fires `abort` event.
2. Backend `await prompt(...)` continues to block.
3. Dialog stays open until user interacts, or until 120s timeout.
4. If the user submits after the backend has moved on, the submission is either dropped or handled by a stale/closed IPC channel.

**Missing defense:** Even if we cannot cancel `prompt()`, we could at least attach an `abort` listener and set a module-level flag so that when `prompt()` finally resolves, we discard the result and return a cancellation. Currently, if the signal aborts after the initial check, the result is still processed and returned as if the signal were valid.

**Test coverage:** None. No test simulates `signal.abort()` during an in-flight `prompt()`.

---

## Additional Observations

### `responseToText` Also Returns "No response" for Empty Objects
Even if `result` is a non-null empty object `{}`, `buildResponse` with `kind: "selection"` produces `selections: []`, and `responseToText` returns `"No response"`. This means the `"No response"` text can be produced in two semantically different ways:
1. `result` is literally `null` (backend-side issue or primitive return).
2. `result` is `{}` or has empty arrays (user actually submitted nothing).

The agent cannot distinguish these from the `content` text alone.

### `details` Shape Mismatch in Error Path
When `prompt()` throws, the error response (`tool/ask-user.ts` lines 207-221) sets:
```ts
details: {
    question: params.question,
    options: normalizedOptions.map((o) => o.title),  // string[]
    response: null,
    cancelled: true,
    error: "No UI available",
}
```

Compare to the `formatResponse` path which uses:
```ts
details: { question, options, response, cancelled }
```
where `options` is `{ title: string; description?: string }[]`.

The error path stores `options` as a flat `string[]` of titles, while the normal path stores the full object array. This is a type inconsistency in the `details` field. Any downstream consumer that expects `options` to be an object array will crash or behave unexpectedly when reading an error-result.

---

## Summary of Root Causes for Backend-Side Timeout Behavior

| Issue | Severity | Root Cause | Location |
|-------|----------|------------|----------|
| Signal abort mid-prompt is ignored | **High** | No `abort` listener; `prompt()` has no cancellation API | `tool/ask-user.ts` lines 100-195 |
| Dialog may stay open after backend error | **Medium** | `catch` block has no window cleanup; `prompt()` returns no handle | `tool/ask-user.ts` lines 207-221 |
| Timeout treated as user cancellation | **Low** | `null` from `prompt()` sets `cancelled: true`, text `"Cancelled"` | `tool/ask-user.ts` lines 196-198 |
| `null result + cancelled=false` reachable | **Low** | Missing `else` for primitive `rawResult` values | `tool/ask-user.ts` lines 188-205 |
| `details.options` shape inconsistent | **Low** | Error path maps to `string[]`, normal path keeps object array | `tool/ask-user.ts` lines 214-220 |

---

## Recommended Investigation Next Steps

1. **Check the webview side** (`webview/src/`) for whether it has any `beforeunload` or `ipc` listener that could detect a "backend gone" state and auto-close the dialog.
2. **Check if `glimpseui` has an undocumented signal/abort option** or if the native host supports closing a `prompt()` window from the backend process.
3. **Consider using `glimpseui.open()` instead of `prompt()`** to obtain a `GlimpseWindow` handle, attach a custom `on("message")` / `on("closed")` handler, and manually call `win.close()` on signal abort. This would require reimplementing the promise-based flow.
4. **Add a guard:** If `signal` is provided, attach an `abort` listener that at least marks the result as "should be discarded" so that a late `prompt()` resolution does not return stale data to the agent.

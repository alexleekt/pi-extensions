# Scout Report: Glimpse Prompt Timeout & Bridge Communication

## Executive Summary

The 120-second timeout added in v0.5.2 protects against indefinite hangs, but **the timeout rejection is misclassified as a Glimpse-unavailability error** rather than a user cancellation. More critically, the **cancel path (`sendCancelled`) is unprotected against bridge failures** — if `window.glimpse` is undefined, pressing Escape or clicking Cancel throws an uncaught error, leaving the dialog open and unresponsive. The submit path is protected by `useBaseDialog.handleSubmit`'s try/catch, but the cancel path has no equivalent guard.

---

## 1. What Happens When `prompt()` Timeout Expires?

### Glimpse Native Behavior

**File:** `node_modules/glimpseui/src/glimpse.mjs` (lines 300–310)

```js
const timer = options.timeout
  ? setTimeout(() => {
      if (!resolved) {
        resolved = true;
        win.close();
        reject(new Error('Prompt timed out'));
      }
    }, options.timeout)
  : null;
```

When the timeout fires, `glimpseui`:
1. Calls `win.close()` (sends a `close` command to the native host).
2. **Rejects the promise** with `new Error('Prompt timed out')`.

Without `timeout`, `prompt()` waits indefinitely for `message`, `closed`, or `error` events.

### Backend Handling (The Bug)

**File:** `tool/ask-user.ts` (lines 149–180)

```ts
const rawResult = (await prompt(html, { ...windowOptions, timeout: 120000 })) as unknown;
// ... cancellation logic for null / __cancelled ...
} catch (_err) {
  // Glimpse unavailable — fast-exit and warn once
  if (!_warnedGlimpseUnavailable) { /* ... */ }
  return {
    content: [{ type: "text", text: "No UI available for ask_user dialog. Please ask the user directly in free-form text." }],
    details: { /* ... */ cancelled: true, error: "No UI available" },
  };
}
```

**Root Cause:** The `catch` block treats **every** error as "Glimpse unavailable". A timeout rejection (`Error: Prompt timed out`) is indistinguishable from a genuine Glimpse crash. The agent receives an error message telling it to "ask the user directly in free-form text" instead of a clean `Cancelled` result.

**Impact:** After 120 seconds, the user loses their dialog context and the agent switches to text-based interaction, which is confusing for the user.

**Recommendation:** Distinguish timeout errors from genuine unavailability errors. If the error message is `'Prompt timed out'`, treat it as a cancellation (return `formatResponse(..., cancelled: true)`), not a tool error.

---

## 2. Is `window.glimpse` Always Available in the Webview?

### No — And the Code Does Not Wait for It

**File:** `webview/src/main.tsx` (lines 25–50)

The webview mounts the React app immediately after validating the payload. There is **no check** for `window.glimpse` existence before rendering:

```tsx
const payload = validatePayload(raw);
// ...
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SettingsProvider ...>
        <App />
      </SettingsProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
```

**File:** `webview/src/util/glimpse.ts` (lines 15–20)

```ts
const bridge = (window as unknown as Record<string, unknown>).glimpse as
  | { send: (data: unknown) => void }
  | undefined;
if (!bridge) {
  throw new Error("Glimpse bridge not available");
}
```

`sendToGlimpse` throws if `window.glimpse` is missing. The native host injects the bridge object into the webview, but this happens asynchronously. If the user interacts with the dialog before injection completes, the bridge is undefined.

**Impact:** In practice, the bridge is usually available by the time the user interacts. But in slow environments, or if the native host has a bug, the bridge could be missing.

---

## 3. Cases Where `sendToGlimpse` Throws but the Error Is Swallowed, Leaving the Dialog Hanging

### The Cancel Path Is Unprotected

**File:** `webview/src/hooks/useBaseDialog.tsx` (lines 48–50, 55–57)

```ts
const handleCancel = useCallback(() => {
  if (hasSent.current || isSubmitting) return;
  if (isDirty) {
    setShowCancelConfirm(true);
    return;
  }
  hasSent.current = true;
  sendCancelled();   // ← THROWS if bridge is down. No try/catch.
}, [isDirty, isSubmitting]);

const handleDiscard = useCallback(() => {
  if (hasSent.current) return;
  hasSent.current = true;
  setShowCancelConfirm(false);
  sendCancelled();   // ← THROWS if bridge is down. No try/catch.
}, []);
```

**File:** `webview/src/hooks/useDialogKeys.ts` (lines 95–99)

```ts
if (s.onCancel) {
  s.onCancel();
} else {
  sendCancelled();   // ← THROWS if bridge is down. In a DOM keydown handler, not a React render cycle.
}
```

**File:** `webview/src/components/DialogFooter.tsx` (lines 42–45)

```tsx
<button onClick={onCancel ?? sendCancelled} ...>
```

If `onCancel` is undefined (which it is for Freeform), `sendCancelled` is passed directly as the click handler. Again, no try/catch.

### Why This Is Worse Than Submit Path Failures

**File:** `webview/src/hooks/useBaseDialog.tsx` (lines 65–76)

```ts
const handleSubmit = useCallback(() => {
  if (hasSent.current) return;
  hasSent.current = true;
  setIsSubmitting(true);
  try {
    onSubmit();        // ← Component's submit logic (which calls sendToGlimpse) is wrapped in try/catch
  } catch (err) {
    console.error("[pi-ask-user-glimpse] Submit failed:", err);
    setIsSubmitting(false);
    hasSent.current = false;   // ← Allows retry
  }
}, [onSubmit]);
```

The **submit path** is protected: `useBaseDialog.handleSubmit` wraps the component's `onSubmit` in try/catch and resets `hasSent` on error, allowing the user to retry.

The **cancel path** has no equivalent protection. If `sendCancelled()` throws:
1. `hasSent.current` is already `true`.
2. The error is thrown in a React event handler or DOM event handler.
3. React's ErrorBoundary may or may not catch it (ErrorBoundary catches render errors, not event handlers).
4. Even if ErrorBoundary catches it, `hasSent` is never reset, so the user cannot retry.
5. The dialog remains visually open because `window.glimpse.send()` never reached the native host, so `--auto-close` never triggered.

**Impact:** User presses Escape → nothing happens. Dialog stays open. User is stuck.

**Recommendation:** Wrap `sendCancelled()` calls in try/catch, or add a `sendToGlimpseSafe()` wrapper that catches bridge errors and optionally shows a UI toast or falls back to `window.close()`.

---

## 4. Does `sendCancelled` / `sendToGlimpse` Properly Close the Glimpse Window?

### Yes, But Indirectly — And Only If the Bridge Works

**File:** `node_modules/glimpseui/src/glimpse.mjs` (lines 292–316)

```js
export function prompt(html, options = {}) {
  return new Promise((resolve, reject) => {
    const win = open(html, { ...options, autoClose: true });   // ← autoClose is forced true
    // ...
    win.once('message', (data) => {
      if (!resolved) {
        resolved = true;
        if (timer) clearTimeout(timer);
        resolve(data);
      }
    });
    // ...
  });
}
```

The `prompt()` function forces `autoClose: true`. This passes `--auto-close` to the native host. The native host is expected to close the window after it receives the **first** message from the webview.

**Flow:**
1. Webview calls `window.glimpse.send(data)` → sends message to native host.
2. Native host receives message → emits `'message'` event → `prompt()` resolves.
3. Native host sees `--auto-close` → closes the window.

### What If the Bridge Is Down?

If `window.glimpse` is undefined or `send()` fails:
- No message reaches the native host.
- `--auto-close` never triggers.
- The window remains open.
- The `prompt()` promise is still pending (waiting for `message`, `closed`, or `error`).
- The only escape hatches are: (a) user manually closes the window, or (b) the 120s timeout fires.

**File:** `webview/src/components/ErrorBoundary.tsx` (lines 21–27)

```ts
componentDidCatch(error: Error) {
  try {
    sendToGlimpse({ __error: true, message: error.message });
  } catch {
    // If the bridge is down, we can't do anything
  }
}
```

If the bridge is down, ErrorBoundary explicitly gives up. The window stays open showing the error UI. The user must manually close it.

**Recommendation:** Add a fallback close mechanism in the webview. If `sendToGlimpse` fails, call `window.close()` or display a "Close Window" button that triggers native window closure. Alternatively, the webview could use a `setTimeout` to auto-close itself after a reasonable period if no message has been sent.

---

## 5. Is the 120s Timeout Too Aggressive?

### Default Behavior: No Timeout

Without the `timeout` parameter, `glimpseui.prompt()` waits indefinitely. The 120s timeout was added to prevent "indefinite hangs if the native Glimpse message is lost."

**File:** `tool/ask-user.ts` (line 149)

```ts
const rawResult = (await prompt(html, { ...windowOptions, timeout: 120000 })) as unknown;
```

### Assessment

- **For simple yes/no or single-select:** 120 seconds is generous.
- **For complex questionnaires with context reading:** 120 seconds may be too short. A user reading a long context panel and answering multiple questions could easily take 2+ minutes.
- **For free-form with thinking:** Same concern.

### The Real Problem

The timeout is a **blunt instrument**. If the native message is truly lost, the timeout is correct. But if the user simply needs more time, the timeout causes data loss (the dialog disappears and the agent gets an error, not the user's partial answers).

**Recommendation:**
1. **Increase timeout** to 300–600 seconds (5–10 minutes) for complex interactions.
2. **Distinguish timeout from true errors** (as noted in Section 1).
3. **Consider removing timeout entirely** and instead fixing the root cause of "lost messages" (which is likely the unprotected cancel/submit paths in the webview, not the native host itself).

---

## Summary of Root Causes

| # | Root Cause | File | Line | Severity |
|---|-----------|------|------|----------|
| 1 | Timeout rejection treated as "Glimpse unavailable" instead of cancellation | `tool/ask-user.ts` | 167–180 | **High** |
| 2 | `sendCancelled()` in cancel path has no try/catch | `webview/src/hooks/useBaseDialog.tsx` | 49, 56 | **High** |
| 3 | `sendCancelled()` in `useDialogKeys` has no try/catch | `webview/src/hooks/useDialogKeys.ts` | 98 | **High** |
| 4 | `window.glimpse` is not checked before rendering the app | `webview/src/main.tsx` | 25–50 | **Medium** |
| 5 | 120s timeout may be too short for complex interactions | `tool/ask-user.ts` | 149 | **Medium** |
| 6 | No fallback window close if the bridge is down | `webview/src/util/glimpse.ts` | 15–20 | **Medium** |
| 7 | Submit path is protected by try/catch, but cancel path is not | `webview/src/hooks/useBaseDialog.tsx` | 65–76 vs 48–57 | **High** |

---

## Start Here

**First file to open:** `webview/src/hooks/useBaseDialog.tsx` (lines 48–57)

Add try/catch around `sendCancelled()` in `handleCancel` and `handleDiscard`, and reset `hasSent` on error so the user can retry. This is the most impactful fix for dialog hangs.

---

## Files Retrieved

1. `tool/ask-user.ts` (lines 140–180) — `prompt()` call, timeout, and catch block handling.
2. `types/glimpseui.d.ts` (lines 1–50) — `GlimpseWindowOptions` interface confirming `timeout?: number`.
3. `webview/src/util/glimpse.ts` (lines 1–30) — `sendToGlimpse` and `sendCancelled` implementation.
4. `webview/src/main.tsx` (lines 1–50) — Webview entry point, no bridge check before render.
5. `webview/src/hooks/useBaseDialog.tsx` (lines 40–80) — Cancel vs submit error handling asymmetry.
6. `webview/src/hooks/useDialogKeys.ts` (lines 90–100) — `sendCancelled` called in DOM keydown handler.
7. `webview/src/components/ErrorBoundary.tsx` (lines 20–30) — Bridge-down fallback in error handling.
8. `node_modules/glimpseui/src/glimpse.mjs` (lines 290–320) — `prompt()` timeout and `autoClose` behavior.

# Error Handling & Race Condition Investigation Report

**Scope:** `useBaseDialog`, `useDialogKeys`, `ErrorBoundary`, `CancelConfirmModal`, `DialogFooter`, `SelectDialog`, `Freeform`, `Questionnaire`, `main.tsx`, `App.tsx`

---

## 1. `hasSent` ref guard and `onSubmit` error handling

### File: `webview/src/hooks/useBaseDialog.tsx` (lines 63–71)

`handleSubmit` wraps `onSubmit` in a try-catch. If `onSubmit` throws synchronously, `hasSent.current` is reset and `isSubmitting` is set back to `false`. This is correct for synchronous errors.

### Issues found

- **a) `sendToGlimpse` can succeed before throwing, enabling a double-send.**  
  `glimpse.ts` (lines 7–25) throws if the bridge is missing, but if `bridge` exists and `bridge.send()` itself throws, the error propagates to `useBaseDialog`’s catch block. `hasSent` is reset, allowing the user to retry, but the host may already have received the first message. **Root cause:** no post-send confirmation / idempotency token.

- **b) `handleCancel` and `handleDiscard` have no try-catch around `sendCancelled()`.**  
  If `sendCancelled` throws (e.g., bridge down), the exception is thrown from a click/keydown event handler. React ErrorBoundary **does not catch event handler errors**, so the app crashes uncaught. The dialog hangs and the host is never notified.  
  - `useBaseDialog.tsx` line 48: `sendCancelled();` (in `handleCancel`)  
  - `useBaseDialog.tsx` line 56: `sendCancelled();` (in `handleDiscard`)  
  - `DialogFooter.tsx` line 42: `onClick={onCancel ?? sendCancelled}` — same issue when `onCancel` is omitted.

- **c) `useDialogKeys` fallback `sendCancelled` also lacks try-catch.**  
  `useDialogKeys.ts` line 65: `sendCancelled();` — if the bridge is down, this throws uncaught from the global keydown listener.

---

## 2. Escape handler race with `CancelConfirmModal`

### File: `webview/src/hooks/useDialogKeys.ts` (lines 48–51)  
### File: `webview/src/components/CancelConfirmModal.tsx` (lines 43–64)

### Mitigations that work
- `useDialogKeys` checks `s.showCancelConfirm` and returns early for Escape.
- `CancelConfirmModal` registers a **capture-phase** listener on `window` and calls `e.stopPropagation()`.

### Issues found

- **a) `stopPropagation()` on `window` does NOT prevent other `window` listeners.**  
  For the same element (`window`), `stopPropagation()` only prevents bubbling/capturing to *other elements*, not to other listeners on the same element. Therefore `useDialogKeys` (bubble phase) still fires after `CancelConfirmModal` (capture phase). The `showCancelConfirm` guard is the only thing preventing `sendCancelled()` from being called. This is fragile — if the guard is ever removed or ref-stale, the race becomes real.

- **b) `CancelConfirmModal` re-registers its capture listener on every parent render.**  
  Dependency array is `[isOpen, onStay]` (line 64). `onStay` is recreated every render (`() => setShowCancelConfirm(false)`). This causes a brief gap between `removeEventListener` and `addEventListener` where no capture listener is active. During that gap, Escape would reach `useDialogKeys` unguarded.

- **c) `SelectDialog` has its own `window` keydown listener that does NOT check `showCancelConfirm`.**  
  `SelectDialog.tsx` (lines 226–254) returns early for `Escape`, but it **does not return early for `Enter`, `ArrowUp`, `ArrowDown`, or digit keys** when the modal is open. This means:
  - While the modal is visible, pressing `ArrowUp`/`ArrowDown` changes the active option index in the hidden options list.
  - Pressing `Enter` on a focused option card (if focus somehow remained behind the modal) triggers submission.
  - Pressing `1`–`9` selects options.
  **Root cause:** `SelectDialog`’s local `window` listener should check `showCancelConfirm` and return early.

---

## 3. ErrorBoundary and React crashes

### File: `webview/src/components/ErrorBoundary.tsx` (lines 27–32)  
### File: `webview/src/main.tsx` (lines 33–43)  
### File: `webview/src/App.tsx` (lines 82–93)

### What works
- `ErrorBoundary` catches render-phase errors and calls `sendToGlimpse({ __error: true, message: … })` inside a try-catch. If the bridge is down, it silently fails.
- `ErrorBoundary` is wrapped around the root, `ContextPanel`, and `renderComponent`.

### Issues found

- **a) `main.tsx` invalid payload throws before the ErrorBoundary is mounted.**  
  If `validatePayload` returns `null`, the code sets `document.body.innerHTML` and then throws `new Error("Invalid payload…")` (line 33). This throw happens **before** `ReactDOM.createRoot(el).render(…)` is called. The ErrorBoundary never mounts, so the host never receives an `__error` message. The dialog hangs with a red error page.

- **b) `App.tsx` `getPayload()` error is caught but never reported to the host.**  
  Lines 84–93: if `getPayload()` throws, `App` renders an error `<div>` but does **not** call `sendToGlimpse({ __error: true, … })`. The host waits forever.

- **c) Event handler errors bypass ErrorBoundary entirely.**  
  As noted in §1b, `sendCancelled` failures in click/keydown handlers are not caught by `ErrorBoundary`. React 18 does not bubble event handler errors to ErrorBoundary. A missing bridge or a thrown `bridge.send()` inside an event handler will crash the app without host notification.

- **d) `componentDidCatch` runs after render, but `getDerivedStateFromError` may run twice in StrictMode.**  
  In `main.tsx` StrictMode is enabled. `getDerivedStateFromError` can fire twice during double-rendering, potentially causing `console.error` to fire twice. This is harmless but noisy.

---

## 4. `isSubmitting` stuck true forever

### File: `webview/src/hooks/useBaseDialog.tsx` (lines 63–71)

`setIsSubmitting(true)` is called before `onSubmit`, but there is **no `setIsSubmitting(false)` after a successful `onSubmit`**. This is intentional (prevent double-submit after the host receives the answer), but it creates a permanent lock if the host does not close the webview.

### Issues found

- **a) After successful `sendToGlimpse`, the dialog is permanently locked.**  
  `isSubmitting` remains `true`. `handleCancel` is blocked (line 46: `if (hasSent.current || isSubmitting) return;`). The Cancel button is disabled (`DialogFooter.tsx` line 41). The user cannot recover or cancel. If the host is slow or the close message is lost, the dialog is a dead UI.

- **b) `isSubmitting` is not cleared on unmount.**  
  If the component unmounts (e.g., webview refreshes), the state is lost, but the host still has the submitted answer. If the webview is re-used without a full reload, the stale state could persist. In practice the webview is destroyed, so this is minor.

- **c) No timeout / watchdog.**  
  There is no mechanism to auto-reset `isSubmitting` if the host does not acknowledge/close within N seconds. A simple timeout could recover from a lost close signal, but at the risk of allowing double-submit.

---

## 5. `Cmd+Enter` in textarea / `allowSubmitInInput`

### File: `webview/src/hooks/useDialogKeys.ts` (lines 68–73)  
### File: `webview/src/hooks/useBaseDialog.tsx` (lines 72–80)

### What works
- `useDialogKeys` defaults `allowSubmitInInput` to `true`.
- `useBaseDialog` does **not** pass `allowSubmitInInput`, so all dialogs inherit `true`.
- `SelectDialog`’s local keydown listener explicitly returns early for `isInInput` (line 247) and for `Cmd+Enter` (line 248), so it does not interfere with `useDialogKeys`.
- `Freeform` and `Questionnaire` have no local keydown listeners, so `useDialogKeys` handles `Cmd+Enter` correctly.

### Issues found

- **a) `useBaseDialog` does not expose `allowSubmitInInput` as a prop.**  
  Future dialog types (or a dialog that wants to disable submit-inside-input) cannot opt out. This is a design limitation, not a current bug.

- **b) `isInInput` only checks `HTMLInputElement` and `HTMLTextAreaElement`.**  
  If a future component uses `contenteditable`, `isInInput` will be `false`, and `Cmd+Enter` will submit regardless of `allowSubmitInInput`. Not currently triggered, but a latent risk.

- **c) `CancelConfirmModal` blocks `Cmd+Enter` via `e.stopPropagation()` in capture phase.**  
  This works in practice because `useDialogKeys` also has the `showCancelConfirm` guard. However, as noted in §2a, `stopPropagation()` on `window` is not a reliable barrier.

---

## Root-Cause Summary Table

| # | Root Cause | Impact | File(s) |
|---|------------|--------|---------|
| 1 | `sendCancelled` / `sendToGlimpse` throws in event handler → uncaught → no host notification | **Dialog hang** (host never knows the dialog crashed) | `useBaseDialog.tsx` lines 48, 56; `DialogFooter.tsx` line 42; `useDialogKeys.ts` line 65 |
| 2 | `main.tsx` & `App.tsx` errors caught locally but never sent to host | **Dialog hang** | `main.tsx` lines 33–34; `App.tsx` lines 84–93 |
| 3 | `isSubmitting` never reset after successful submit; no timeout | **Permanent UI lock** if host does not close webview | `useBaseDialog.tsx` lines 63–71 |
| 4 | `SelectDialog` window listener ignores `showCancelConfirm` | **Modal bypass** — keys reach hidden UI | `SelectDialog.tsx` lines 226–254 |
| 5 | `CancelConfirmModal` listener re-registers every render (stale `onStay`) | **Brief gap** where Escape is unguarded | `CancelConfirmModal.tsx` line 64 |
| 6 | `bridge.send()` can throw after message already sent → `hasSent` reset | **Double-submit** risk | `glimpse.ts` lines 7–25 |

---

## Recommended Fix Priority

1. **High:** Wrap all `sendCancelled()` and `sendToGlimpse()` calls in event handlers with try-catch, and send `__error` to the host if they fail. Add a global `window.onerror` / `window.onunhandledrejection` fallback in `main.tsx` that also calls `sendToGlimpse({ __error: true, message: … })`.
2. **High:** In `main.tsx` and `App.tsx`, catch payload errors and explicitly send `__error` to Glimpse before rendering the error UI.
3. **High:** Add a `showCancelConfirm` guard to `SelectDialog`’s local `window` keydown listener (return early if modal is open).
4. **Medium:** Stabilize `CancelConfirmModal`’s listener registration by wrapping `onStay`/`onDiscard` in `useCallback` in the parent components, or by reading `showCancelConfirm` from a ref inside the modal to avoid re-registration.
5. **Medium:** Consider adding a submission timeout (e.g., 5s) that resets `isSubmitting` if the host does not close the webview, or at least shows a “Stuck? Close manually” UI.
6. **Low:** Consider adding `allowSubmitInInput` to `UseBaseDialogOptions` so individual dialog types can opt out.

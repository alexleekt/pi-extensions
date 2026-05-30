# Progress

## Status
In Progress

## Tasks
- [x] Scout dialog component submission flow (SelectDialog, Freeform, Questionnaire, QuestionCard)
- [x] Analyze empty-submission edge cases, allowSkip enforcement, and Glimpse bridge behavior
- [x] Write findings to `scout-component-submit-report.md`
- [x] Investigate error handling and race conditions in dialog components
- [x] Write findings to `scout-error-race-report.md`

## Files Changed
- `scout-component-submit-report.md` (created)
- `scout-error-race-report.md` (created)

## Notes
### Prior scout findings
1. **Questionnaire ignores `allowSkip`** — `submitDisabled` is never passed to `useBaseDialog`, so empty questionnaires can be submitted even when `allowSkip: false`. This is the highest-severity gap.
2. **Freeform allows empty text** — `submitDisabled` is not set, so empty freeform submissions are always possible. This is low-severity UX.
3. **SelectDialog fallback selection** — When `hasFreeform` is true and `selected === null`, clicking Submit uses the keyboard-focused option as a fallback instead of freeform. Low-severity UX inconsistency.
4. **Glimpse bridge unavailability** — If `window.glimpse` is undefined, `sendToGlimpse` throws, `useBaseDialog` catches it, and the dialog stays open. The user is stuck. This is an environment failure.
5. **All components close correctly** when `sendToGlimpse` succeeds, because `window.glimpse.send()` resolves the `glimpseui.prompt()` promise synchronously.

### Error handling & race condition findings
1. **`sendCancelled` / `sendToGlimpse` throws in event handlers bypass ErrorBoundary** — React does not catch errors from event handlers. If the bridge is down, `handleCancel`, `handleDiscard`, `DialogFooter` fallback, and `useDialogKeys` fallback all throw uncaught. The host is never notified. Dialog hangs.
2. **`main.tsx` & `App.tsx` payload errors are not reported to host** — Invalid payload throws before ErrorBoundary mounts, or is caught by `App` try-catch but never sent to Glimpse. Dialog hangs with red error page.
3. **`isSubmitting` is never reset after successful submit** — If the host does not close the webview, the dialog is permanently locked. No cancel, no retry. Needs a timeout or recovery UI.
4. **`SelectDialog` window listener ignores `showCancelConfirm`** — Arrow keys, digit keys, and Enter can still manipulate the options list while the cancel-confirm modal is open. Modal bypass risk.
5. **`CancelConfirmModal` re-registers capture listener every render** — `onStay` dependency is recreated each render, causing a brief gap where no capture listener is active. Escape could leak.
6. **`bridge.send()` can throw after message is already sent** — `sendToGlimpse` would throw, `useBaseDialog` catch resets `hasSent`, and user can double-submit. Low probability but real.

## Next Steps
1. Fix `handleCancel`/`handleDiscard` try-catch gaps in `useBaseDialog`
2. Add global error handler in `main.tsx` for unhandled errors/rejections
3. Send `__error` from `App.tsx` and `main.tsx` payload validation failures
4. Add `showCancelConfirm` guard to `SelectDialog` local keydown listener
5. Stabilize `CancelConfirmModal` listener dependencies
6. Consider submission timeout / watchdog for `isSubmitting` lock

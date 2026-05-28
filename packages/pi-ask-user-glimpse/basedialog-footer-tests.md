# useBaseDialog and DialogFooter Test Implementation

## useBaseDialog Tests

Created `webview/src/hooks/__tests__/useBaseDialog.test.tsx` with 10 tests covering:

1. **Initial state**: `isSubmitting` is `false`, `showCancelConfirm` is `false`
2. **handleSubmit sets isSubmitting=true**: Uses `waitFor` to handle React 18 batching
3. **handleSubmit error handling**: Catches thrown errors, resets `isSubmitting` to `false`, logs to console
4. **Double-submit guard**: `hasSent` ref blocks second `handleSubmit` call
5. **handleCancel shows confirm when dirty**: Sets `showCancelConfirm` to `true`
6. **handleCancel sends cancelled when clean**: Calls `sendCancelled` directly
7. **handleCancel blocked during submit**: Returns early when `isSubmitting` is `true`
8. **handleDiscard calls sendCancelled**: Sets `hasSent` ref and calls `sendCancelled`
9. **Double-cancel guard**: `hasSent` ref blocks second `handleDiscard` call
10. **Cross-guard**: `handleSubmit` after `handleDiscard` is blocked

**Mocking strategy**: Mocked `useDialogKeys`, `DialogFooter`, `GlobalKeyboardHint`, and `FooterContext` to avoid React rendering issues and window-level listener setup that caused vitest worker timeouts in earlier attempts.

## DialogFooter Expanded Tests

Added to `webview/src/components/__tests__/DialogFooter.test.tsx`:

1. **aria-live region**: Verifies `sr-only` div with `aria-live="assertive"` and `aria-atomic="true"` announces "Submitting answer" when `isSubmitting=true`
2. **Cancel disabled during submit**: `Cancel` button has `disabled` attribute when `isSubmitting=true`
3. **Submit disabled during submit**: `Submitting…` button has `disabled` attribute when `isSubmitting=true`

## Validation

- All 237 unit tests pass (20 test files)
- All 31 e2e tests pass
- Typecheck passes cleanly
- Build succeeds via wireit

## Coverage Impact

- useBaseDialog: 68.75% → ~100% (with mocked child components)
- DialogFooter: improved coverage for aria-live and disabled states

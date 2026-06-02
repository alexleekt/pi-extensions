# ROADMAP — pi-ask-user-glimpse

> Current status, known issues, and upcoming work.
>
> For what has already shipped, see [CHANGELOG.md](./CHANGELOG.md).
> For glossary and terminology, see [CONTEXT.md](./CONTEXT.md).

## Status

| Version | Date | Status |
|---------|------|--------|
| v0.5.2 | 2026-05-29 | 🔴 Active development |

## Known Issues

### 🟢 Image Attachment Bug in `ask_user` Responses
- **Severity:** Medium
- **Status:** Defensively mitigated in extension; upstream fix still required
- **Description:** When the user responds with plain text, the system sometimes injects `(see attached image)` into the assistant's context even though no image was sent. This breaks the grilling session flow.
- **Root cause:** `pi-ai` package uses `(see attached image)` as a hardcoded fallback when tool result text is empty. Gated by `hasImages` in `google-shared.js` and `mistral.js`, but **not** in `openai-completions.js` or `anthropic.js`.
- **Mitigation:** `responseToText()` in `tool/response-formatter.ts` never returns empty text — returns `"No response"` instead.
- **Upstream:** Pending fix in `pi-ai` package.

### 🟡 Questionnaire ignores `allowSkip` — EMPTY SUBMISSION
- **Severity:** Medium
- **Status:** Documented, not yet fixed
- **Description:** `submitDisabled` is never passed to `useBaseDialog`, so empty questionnaires can be submitted even when `allowSkip: false`.
- **File:** `webview/src/components/Questionnaire.tsx`

### 🟡 Freeform allows empty text
- **Severity:** Low
- **Status:** By design (low-severity UX)
- **Description:** `submitDisabled` is not set, so empty freeform submissions are always possible.

### 🟡 SelectDialog fallback selection
- **Severity:** Low
- **Status:** Documented, not yet fixed
- **Description:** When `hasFreeform` is true and `selected === null`, clicking Submit uses the keyboard-focused option as a fallback instead of freeform.

### 🟡 Glimpse bridge unavailability — user stuck
- **Severity:** Low
- **Status:** Mitigated
- **Description:** If `window.glimpse` is undefined, `sendToGlimpse` throws, `useBaseDialog` catches it, and the dialog stays open. The user is stuck.
- **Mitigation:** `sendToGlimpse()` now validates `window.glimpse` exists before calling `send()`.

### 🟡 `isSubmitting` is never reset after successful submit
- **Severity:** Medium
- **Status:** Not yet fixed
- **Description:** If the host does not close the webview, the dialog is permanently locked. No cancel, no retry.
- **File:** `webview/src/components/useBaseDialog.tsx`

### 🟡 `CancelConfirmModal` re-registers capture listener every render
- **Severity:** Low
- **Status:** Not yet fixed
- **Description:** `onStay` dependency is recreated each render, causing a brief gap where no capture listener is active. Escape could leak.

## In Progress

### v0.5.3 — Error Handling & Race Conditions

- [ ] Fix `handleCancel`/`handleDiscard` try-catch gaps in `useBaseDialog`
- [ ] Add global error handler in `main.tsx` for unhandled errors/rejections
- [ ] Send `__error` from `App.tsx` and `main.tsx` payload validation failures
- [ ] Add `showCancelConfirm` guard to `SelectDialog` local keydown listener
- [ ] Stabilize `CancelConfirmModal` listener dependencies
- [ ] Consider submission timeout / watchdog for `isSubmitting` lock

## Next Up

### v0.6.0 — Unified Dialog Architecture

- [ ] Centralize keyboard listeners from components into `App.tsx` or a provider context
- [ ] Unify empty-submit behavior across all dialog types
- [ ] Remove remaining dead code (ShortcutsModal, renderOptionText)
- [ ] Add per-option comment visibility consistency

### v0.7.0 — Prompt Engineering Overhaul

- [ ] Redraft `ask_user` prompt incorporating identity framing, imperative default, specific triggers
- [ ] A/B test new prompt vs current prompt
- [ ] Measure tool invocation rate, user response rate, downstream task success

## Research Files

The following files are **temporary research artifacts** and are not part of the unified documentation structure:

- `research.md` — AI agent "ask user" triggering patterns research
- `progress.md` — Scout investigation progress tracker
- `scout-*-report.md` (6 files) — Scout investigation reports
- `*-tests.md` (9 files) — Test planning documents

These are retained for historical reference but are not linked from the unified docs.

## Icebox

- [ ] Custom window icons in Glimpse (API does not exist in v0.8.1)
- [ ] Sandbox relaxation for external libraries (D3, p5.js) — Verdict: DO NOT relax

## Completed

- [x] HTML context iframe with theme propagation — v0.4.0
- [x] Mermaid diagram support in markdown context — v0.3.0
- [x] Auto-catch free-form questions — v0.4.0 (removed in v0.5.0)
- [x] Security hardening (DOMPurify, CSP, XSS test suite) — v0.5.2
- [x] Form consolidation (850 lines deduplicated) — v0.5.2
- [x] Test coverage 98%+ across 29 files — v0.5.2

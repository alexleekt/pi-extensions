# ROADMAP — pi-ask-user-glimpse

> Current status, known issues, and upcoming work.
>
> For what has already shipped, see [CHANGELOG.md](./CHANGELOG.md).
> For glossary and terminology, see [CONTEXT.md](./CONTEXT.md).

## Status

| Version | Date | Status |
|---------|------|--------|
| v0.6.1 | — | 🔴 Active development (unreleased) |
| v0.6.0 | 2026-06-11 | 🟢 Released |

## Known Issues

### 🟢 Image Attachment Bug in `ask_user` Responses
- **Severity:** Medium
- **Status:** Defensively mitigated in extension; upstream fix still required
- **Description:** When the user responds with plain text, the system sometimes injects `(see attached image)` into the assistant's context even though no image was sent.
- **Root cause:** `pi-ai` package uses `(see attached image)` as a hardcoded fallback when tool result text is empty. Gated by `hasImages` in `google-shared.js` and `mistral.js`, but **not** in `openai-completions.js` or `anthropic.js`.
- **Mitigation:** `responseToText()` in `tool/response-formatter.ts` never returns empty text — returns `"No response"` instead.
- **Upstream:** Pending fix in `pi-ai` package.

### 🟡 Freeform allows empty text
- **Severity:** Low
- **Status:** By design (low-severity UX)
- **Description:** `submitDisabled` is not set, so empty freeform submissions are always possible. This is intentional — the user may have nothing to add to an open question.

### 🟡 SelectDialog fallback selection
- **Severity:** Low
- **Status:** Documented, not yet fixed
- **Description:** When `hasFreeform` is true and `selected === null`, clicking Submit uses the keyboard-focused option as a fallback instead of freeform.

### 🟡 Glimpse bridge unavailability — user stuck
- **Severity:** Low
- **Status:** Mitigated
- **Description:** If `window.glimpse` is undefined, `sendToGlimpse` throws, `useBaseDialog` catches it, and the dialog stays open.
- **Mitigation:** `sendToGlimpse()` now validates `window.glimpse` exists before calling `send()`.

## Next Up

### v0.6.x — Unified Dialog Architecture

- [ ] Centralize keyboard listeners from components into `App.tsx` or a provider context
- [ ] Unify empty-submit behavior across all dialog types
- [ ] Add per-option comment visibility consistency

### v0.7.0 — Prompt Engineering Overhaul

- [ ] Redraft `ask_user` prompt incorporating identity framing, imperative default, specific triggers
- [ ] A/B test new prompt vs current prompt
- [ ] Measure tool invocation rate, user response rate, downstream task success

## Icebox

- [ ] Custom window icons in Glimpse (API does not exist in v0.8.1)
- [ ] Sandbox relaxation for external libraries (D3, p5.js) — Verdict: DO NOT relax

## Completed

- [x] Content zoom (50–250%) persisted across dialogs — v0.6.x
- [x] Agent preamble capture — v0.6.0
- [x] HTML context auto-downgrade — v0.6.0
- [x] `#<header>` autocomplete + journal re-seed — v0.6.0
- [x] `/ask-debug` argument completion — v0.6.0
- [x] Keyboard shortcuts (1-9, arrows, Enter, Esc, ⌘Enter) — v0.1.1
- [x] Multi-theme support (20+ themes) — v0.6.x
- [x] Error handling & race condition hardening (hasSent guard, timeout/watchdog, try-catch, `__error`) — v0.5.2–v0.6.0
- [x] Questionnaire `allowSkip` submit gating — v0.6.0
- [x] HTML context iframe with theme propagation — v0.4.0
- [x] Mermaid diagram support in markdown context — v0.3.0
- [x] Auto-catch free-form questions — v0.4.0 (removed in v0.5.0)
- [x] Security hardening (DOMPurify, CSP, XSS test suite) — v0.5.2
- [x] Form consolidation (850 lines deduplicated) — v0.5.2
- [x] Dead code removal (ShortcutsModal, renderOptionText) — v0.5.2
- [x] Test coverage 98%+ across 35 files (438 tests) — v0.6.x

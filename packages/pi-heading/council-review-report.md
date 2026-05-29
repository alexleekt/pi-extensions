# Council Review Report: "Showing Working instead of my message"

**Date:** 2026-05-28
**Issue:** User reports "it is still showing Working instead of my message" in `pi-ask-user-glimpse`
**Packages reviewed:** `pi-ask-user-glimpse`, `pi-heading`
**Reviewer:** Senior Council Member

---

## 1. Executive Summary

The literal string **"Working"** does not exist in the `pi-ask-user-glimpse` source code. After evaluating all four team reports against the actual codebase, the primary root cause is an **interaction bug in `pi-heading`** that leaves Pi's native status bar showing the default "Working" text. A secondary contributing factor is `pi-ask-user-glimpse`'s `summarizeTitle()` function, which can produce "Working" as a window title for certain questions.

**Recommendation:** Fix both packages. `pi-heading` must fix its platform-level working indicator lifecycle. `pi-ask-user-glimpse` should improve its title generation and optionally override the Pi status bar during dialog execution.

---

## 2. Evidence Quality and Consistency

### Verified Claims (All 4 Teams Agree)

| Claim | Evidence | Status |
|-------|----------|--------|
| "Working" does not exist in `pi-ask-user-glimpse` source | `grep -ri "working"` across all `.ts`, `.tsx`, `.js`, `.html`, `.css` returns zero matches in source code | **Confirmed** |
| `summarizeTitle()` can produce "Working" | `STOPWORDS` contains `work`/`worked` but **not** `working`. Question "What are you working on?" → contentWords = `["working"]` → title = `"Working"` | **Confirmed** |
| `pi-heading` manipulates Pi's native working indicator | `ui/widget.ts` calls `ctx.ui.setWorkingMessage()`; `index.ts` calls `ctx.ui.setWorkingVisible(true)` | **Confirmed** |
| `clearHeading()` calls `setWorkingMessage()` with no args | `ui/widget.ts:30` — `ctx.ui.setWorkingMessage();` | **Confirmed** |
| `pi-heading` never calls `setWorkingVisible(false)` | `grep` shows only `setWorkingVisible(true)` in `index.ts:181` and `index.ts:187` | **Confirmed** |
| Question only rendered in left `ContextPanel` | `App.tsx` passes `question` only to `ContextPanel`; `SelectDialog`, `Freeform`, `Questionnaire` do not render `payload.question` | **Confirmed** |

### Evidence Gaps

- **No runtime verification** of whether `ctx.ui.setWorkingMessage()` with no arguments actually resets to "Working" in Pi's native implementation. The mock tests in `pi-heading` simply record `undefined`, but the real Pi platform behavior is unknown.
- **No runtime verification** of whether `setWorkingVisible(true)` resets the working message text as a side effect.
- **No test** in `pi-ask-user-glimpse` for `summarizeTitle()` behavior with stopword-heavy questions.

---

## 3. Root Cause Analysis

### 3.1 PRIMARY Root Cause: `pi-heading` Working Indicator Lifecycle Bug

**Location:** `packages/pi-heading/ui/widget.ts` and `packages/pi-heading/index.ts`

**Mechanism:**

1. **`clearHeading()` resets to platform default:**
   ```typescript
   // ui/widget.ts:30
   export function clearHeading(ctx: ExtensionContext): void {
     ctx.ui.setWorkingMessage();  // ← no arguments
   }
   ```
   If Pi's native implementation treats `setWorkingMessage(undefined)` as "reset to default", the default text is **"Working"**. This is called from:
   - `session_start` (line 161) — when no replayed state exists
   - `agent_end` (line 178) — when no state exists
   - `session_shutdown` (line 186) — always

2. **`setWorkingVisible(true)` may reset message text:**
   ```typescript
   // index.ts:181
   ctx.ui.setWorkingMessage(trimmed);   // ← sets custom goal text
   // ...
   ctx.ui.setWorkingVisible(true);      // ← potential reset to "Working"
   ```
   In `agent_end`, the custom goal text is set *before* `setWorkingVisible(true)`. If the native implementation resets the text when making the indicator visible, the custom text is immediately overwritten.

3. **First-turn race condition leaves "Working" visible:**
   ```
   session_start → clearHeading() → setWorkingMessage() → default "Working"
   before_agent_start → starts async summarize (no immediate setWorkingMessage)
   agent_start → state?.goal is undefined → does nothing → "Working" persists
   summarize completes → setHeadingMessage(ctx, result.goal) → finally shows goal
   ```
   During the async gap (potentially hundreds of milliseconds), the user sees "Working".

4. **ADR 0002 implementation divergence:**
   The ADR explicitly states: *"When the widget spinner is active, `ctx.ui.setWorkingVisible(false)` hides Pi's built-in 'Working...' row."* However, the current codebase **never calls `setWorkingVisible(false)`**. Pi's native "Working" loader is never suppressed.

### 3.2 SECONDARY Root Cause: `summarizeTitle()` Produces "Working" for Window Title

**Location:** `packages/pi-ask-user-glimpse/tool/ask-user.ts:23–47`

**Mechanism:**

```typescript
function summarizeTitle(question: string, maxWords = 3): string {
    const contentWords = question
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 0 && !STOPWORDS.has(w));
    // ...
}
```

`STOPWORDS` (line 147 in `constants/stopwords.ts`) contains `work` and `worked` but **not** `working`. For the question "What are you working on?":
- After stopword removal: `["working"]`
- Result: `"Working"`

This becomes the window title passed to `glimpseui.prompt()`. If the user sees "Working" in the macOS window title bar, this is the direct cause.

### 3.3 TERTIARY Contributing Factor: Question Only in Left Panel

**Location:** `packages/pi-ask-user-glimpse/webview/src/App.tsx:126–140`

The `payload.question` is passed **only** to the `ContextPanel` on the left. The main dialog area (`SelectDialog`, `Freeform`, `Questionnaire`) does not render the question. If the user collapses the left panel, the question disappears from view, making the window title the only visible reference to the question — which may be "Working".

---

## 4. Prioritized Fix List

### P0: Fix `pi-heading` Working Indicator Lifecycle

These fixes address the primary root cause. They must be implemented in `pi-heading`.

| Priority | File | Change | Rationale |
|----------|------|--------|-----------|
| **P0.1** | `ui/widget.ts:30` | Change `ctx.ui.setWorkingMessage();` to `ctx.ui.setWorkingMessage("");` or pass an empty string to avoid platform default reset. | `clearHeading()` currently calls `setWorkingMessage()` with no args, which may reset to "Working". |
| **P0.2** | `index.ts:175–181` | In `agent_end`, call `ctx.ui.setWorkingVisible(true)` **before** `setHeadingMessage()`, or call `setHeadingMessage()` again after `setWorkingVisible(true)`. | If `setWorkingVisible(true)` resets the text as a side effect, the current order loses the custom goal text. |
| **P0.3** | `index.ts:97–160` | In `before_agent_start`, set an immediate placeholder before the async summarize: `setHeadingMessage(ctx, "Analyzing...", "working")` or `setHeadingMessage(ctx, prompt.slice(0, 60), "working")`. | Eliminates the first-turn race condition where "Working" is visible during the async gap. |
| **P0.4** | `index.ts:123–126` | When `result.goal.trim()` is empty, set a fallback message (e.g., the original prompt or "Analyzing...") instead of returning without updating the working message. | Empty LLM responses currently leave the previous/default text visible. |
| **P0.5** | `index.ts:259–281` | Add `ctx.ui.setWorkingVisible(false)` in `agent_start` and `turn_start`, and restore `setWorkingVisible(true)` in `agent_end`. | Aligns with ADR 0002 to suppress Pi's native "Working" loader during agent execution. |

### P1: Fix `pi-ask-user-glimpse` Title and UX

These fixes address the secondary root cause and improve UX.

| Priority | File | Change | Rationale |
|----------|------|--------|-----------|
| **P1.1** | `tool/ask-user.ts:23–47` | Replace `summarizeTitle()` with a **first-sentence or first-N-words** approach. Stopword filtering is too aggressive for short questions. | Prevents nonsensical single-word titles like "Working" for questions that are mostly stopwords. |
| **P1.2** | `index.ts:653` | In `askUserTool.execute()`, call `ctx.ui.setWorkingMessage?.(params.question.slice(0, 60))` before opening the dialog, and clear it in a `finally` block. | Overrides Pi's generic "Working" status with the actual question text while the dialog is open. |
| **P1.3** | `webview/src/components/SelectDialog.tsx`, `Freeform.tsx`, `Questionnaire.tsx` | Add a question header at the top of each dialog component so the question is visible even when the left panel is collapsed. | The README claims "Prominent question header — full non-truncated question text in the header bar"; the current implementation only shows it in the collapsible left panel. |

### P2: Verify and Test

| Priority | Action | Rationale |
|----------|--------|-----------|
| **P2.1** | Add a test in `pi-heading/ui/widget.test.ts` for `clearHeading()` with empty string argument. | Ensure the fix is tested. |
| **P2.2** | Add a test in `pi-ask-user-glimpse/tool/__tests__/ask-user.test.ts` for `summarizeTitle()` with stopword-heavy questions. | Ensure "Working" is never produced as a title. |
| **P2.3** | Manual end-to-end test: run `ask_user` with question "What are you working on?" and verify both the window title and Pi status bar. | Confirm the fix works in the real environment. |

---

## 5. Package Modification Assessment

| Package | Must Modify? | Rationale |
|---------|-------------|-----------|
| **`pi-heading`** | **Yes — P0 fixes mandatory** | The primary root cause is the working indicator lifecycle bug. `clearHeading()`, `setWorkingVisible()`, and the first-turn race condition are all in this package. |
| **`pi-ask-user-glimpse`** | **Yes — P1 fixes recommended** | The secondary root cause (`summarizeTitle`) and UX gap (question only in left panel) are in this package. Additionally, the tool should override Pi's working message during dialog execution. |
| **Pi core (`@earendil-works/pi-coding-agent`)** | **No — unless P0 fixes fail** | If `setWorkingMessage()` with no args *does not* reset to "Working" in Pi's native implementation, then the primary hypothesis is wrong. If `setWorkingMessage(params.question)` inside the tool's `execute()` is overridden by Pi core on every turn, then an upstream fix is needed. This should be tested first. |

---

## 6. Final Recommendation

**Fix both `pi-heading` and `pi-ask-user-glimpse`.**

1. **`pi-heading` is the primary fix.** The `clearHeading()` no-arg call, the missing `setWorkingVisible(false)` during agent execution, and the first-turn race condition are all platform-level bugs that affect every tool execution, not just `ask_user`. These must be fixed regardless of the `ask_user` issue.

2. **`pi-ask-user-glimpse` is the secondary fix.** The `summarizeTitle()` function is a real, verifiable bug that produces "Working" as a window title for common questions. The tool should also override Pi's working message during dialog execution to show "Waiting: {question}" instead of the generic "Working".

3. **If the Pi core overrides `setWorkingMessage()` on every turn** (i.e., the P0 and P1 fixes do not resolve the issue), then escalate to `@earendil-works/pi-coding-agent` with a feature request for per-tool status display.

---

## 7. Risk Assessment

| Risk | Mitigation |
|------|------------|
| `clearHeading()` with ` ""` may not work if Pi's native API requires `undefined` to clear | Test with both `undefined` and `""` in a real Pi environment. The ADR says Pi provides this API; its behavior should be documented. |
| `setWorkingVisible(false)` may have side effects on other extensions | This is the intended behavior per ADR 0002. `pi-heading` already owns the working indicator lifecycle. |
| `summarizeTitle()` replacement may break existing tests | There are no existing tests for `summarizeTitle()`. The new first-sentence approach is safer. |
| Adding `ctx.ui.setWorkingMessage()` to `ask_user` creates a cross-extension dependency | This is a standard Pi API call, not a dependency on `pi-heading`. It is safe to use. |

---

*Report compiled by Senior Council Member. All findings are verified against the actual codebase, not inferred from team reports alone.*

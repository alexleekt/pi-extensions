# Scout Report: Dialog Component Submission Flow

## Files Examined
- `webview/src/components/SelectDialog.tsx` (lines 58-117, 138-160, 174-226)
- `webview/src/components/Freeform.tsx` (lines 18-28)
- `webview/src/components/Questionnaire.tsx` (lines 33-64, 96-108)
- `webview/src/components/QuestionCard.tsx` (lines 37-46, 58)
- `webview/src/hooks/useBaseDialog.tsx` (lines 47-72)
- `webview/src/hooks/useDialogKeys.ts` (lines 62-78)
- `webview/src/util/glimpse.ts` (lines 9-23)
- `tool/ask-user.ts` (lines 178-190)
- `tool/response-formatter.ts` (lines 14-22, 44-52, 78-86)

---

## 1. SelectDialog Single-Mode + FREEFORM_OPTION_TITLE

**Location:** `SelectDialog.tsx` lines 84-88

```typescript
if (s.selected === FREEFORM_OPTION_TITLE) {
    send({ kind: "freeform", text: "" });
    return;
}
```

**Finding:** When `mode === "single"` and the user selects the freeform option, it sends `{ kind: "freeform", text: "" }` and the dialog closes correctly. There is no freeform text input in single-select mode — the freeform option is just a sentinel choice ("My answer isn't listed above"). So `text: ""` is correct by design; the user is signaling that their answer isn't in the list, not typing a custom response.

**Root cause risk:** None. The dialog closes because `sendToGlimpse` calls `window.glimpse.send()` synchronously, which resolves the `glimpseui.prompt()` promise.

---

## 2. Freeform Empty Text Submission

**Location:** `Freeform.tsx` lines 18-28

```typescript
const handleSubmit = useCallback(() => {
    const result: Record<string, unknown> = {
        kind: "freeform",
        text: text.trim(),
    };
    if (comment.trim()) {
        result.comment = comment.trim();
    }
    sendToGlimpse(result);
}, [text, comment]);
```

**Finding:** If the user leaves the textarea empty and clicks Submit, it sends `{ kind: "freeform", text: "" }`. The dialog closes. `submitDisabled` is **not passed** to `useBaseDialog` in `Freeform` (line 45), so the submit button is always enabled. The backend `responseToText` converts this to `"No response"` (`response-formatter.ts` line 86).

**Root cause risk:** Low. Glimpse accepts empty strings and resolves the promise. The agent receives `"No response"`, which may be surprising if the user intended to type something but accidentally hit Submit. This is a UX gap, not a technical failure.

---

## 3. Questionnaire: `allowSkip` Is Completely Ignored in the UI

**Location:** `Questionnaire.tsx` lines 33-64, 96-108

```typescript
const handleSubmit = useCallback(() => {
    const s = stateRef.current;
    const questionnaireDetails = s.questions
        .map((q) => {
            const answer = s.answers[q.title];
            if (!isAnswered(answer)) return null;
            // ...
        })
        .filter(Boolean) as { ... }[];

    const result: Record<string, unknown> = {
        kind: "questionnaire",
        selections: questionnaireDetails.map((s) => `${s.question}: ${s.answer}`),
        questionnaireDetails,
    };
    sendToGlimpse(result);
}, []);
```

**Finding:** `allowSkip` exists on `AskUserPayload` (`shared/ask-user.ts` line 41) but the `Questionnaire` component **never reads it**. The `submitDisabled` prop is **not passed** to `useBaseDialog` (line 108). The submit button is always enabled, even when:
- `allowSkip = false`
- Zero questions are answered
- Some questions are unanswered

`QuestionCard.tsx` hardcodes `isRequired = true` (line 58) and shows a "Required" badge, but there is no enforcement.

**Root cause risk:** HIGH. If a tool caller sets `allowSkip: false`, the user can still submit an empty questionnaire. The backend formats it as `"No response"` (`response-formatter.ts` line 86). The agent may then proceed with no data, or loop asking again, causing confusion or timeouts.

**Fix needed:** `Questionnaire` should compute:
```typescript
const allAnswered = questions.every((q) => isAnswered(answers[q.title]));
const submitDisabled = !payload.allowSkip && !allAnswered;
```
and pass `submitDisabled` to `useBaseDialog`.

---

## 4. Dialog States Where Submit Is Enabled but Clicking It Sends Nothing

**Location:** `useBaseDialog.tsx` lines 53-64, `glimpse.ts` lines 9-23

**Finding:** The only case where the submit button is enabled but the click does not send data to Glimpse is when `window.glimpse` is undefined (bridge missing). In that case:
1. `sendToGlimpse` throws `"Glimpse bridge not available"`.
2. `useBaseDialog.handleSubmit` catches the error.
3. It resets `isSubmitting` to `false` and `hasSent.current` to `false`.
4. The dialog stays open. The user sees a brief "Submitting…" flash then the button reverts.

**Root cause risk:** Medium. This is an environment failure, but the user is stuck in a dialog that cannot close via submission. The only escape is Cancel (which works if `sendCancelled` can also reach the bridge — but if the bridge is missing, `sendCancelled` also throws).

**Secondary gap:** `SelectDialog` fallback logic. When `hasFreeform` is true and `selected === null`, `submitDisabled` is false. Clicking Submit uses `fallbackSelection` from `activeIndex` (line 93-94). If `activeIndex` points to a real option, it submits that option instead of freeform. This is a UX inconsistency: the button is enabled (because freeform is allowed), but clicking it may submit a focused option the user never explicitly selected.

```typescript
const fallbackSelection =
    s.activeIndex >= 0 && s.activeIndex < s.options.length
        ? s.options[s.activeIndex].title
        : null;
const selection = s.selected ?? fallbackSelection;
```

---

## 5. Cases Where `sendToGlimpse` Is Called but the Window Doesn't Close

**Location:** `glimpse.ts` lines 9-23, `tool/ask-user.ts` lines 178-190

**Finding:** `glimpseui.prompt()` resolves as soon as `window.glimpse.send(data)` is called. So under normal conditions, the window always closes immediately after `sendToGlimpse` is called.

The only exception is when `window.glimpse` is undefined. In that case:
- `sendToGlimpse` throws before `bridge.send()` is ever invoked.
- The window stays open.
- There is no retry or fallback mechanism.

**Other potential issue:** `Ctrl+Enter` vs regular `Enter` inconsistency in `SelectDialog`.
- `useDialogKeys.stableSubmit` (called by `Ctrl+Enter`) respects `submitDisabled`.
- `SelectDialog`'s own `Enter` handler (line 174-226) bypasses `submitDisabled` for keyboard navigation and can submit a focused option even when the button is disabled.
- This means a user can `Enter`-submit a disabled state, but cannot `Ctrl+Enter`-submit it. This is inconsistent but does not cause a timeout — it just changes the selection unexpectedly.

---

## Summary of Root Causes

| Issue | Severity | File / Line | Impact |
|-------|----------|-------------|--------|
| **Questionnaire ignores `allowSkip`** | High | `Questionnaire.tsx:96-108` | Empty submissions when caller expected mandatory answers. Agent receives `"No response"`. |
| **Glimpse bridge missing** | Medium | `glimpse.ts:15-22` | User stuck in dialog; submission throws, caught by `useBaseDialog`, state resets. |
| **SelectDialog fallback auto-selects focused option** | Low | `SelectDialog.tsx:93-101` | Clicking Submit with no explicit selection may pick the focused option instead of freeform. |
| **Freeform empty submit always enabled** | Low | `Freeform.tsx:45` | User can accidentally submit empty freeform. |

**Recommended start file for a fix:** `webview/src/components/Questionnaire.tsx` — add `submitDisabled` enforcement based on `payload.allowSkip` and answered count.

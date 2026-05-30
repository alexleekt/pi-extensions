# pi-ask-user-glimpse: "Showing Working instead of my message" — Investigation Report

**Date:** 2026-05-28
**Issue:** User reports "it is still showing Working instead of my message" in the `pi-ask-user-glimpse` extension.

---

## Executive Summary

**The word "Working" does NOT exist anywhere in the `pi-ask-user-glimpse` source code as a placeholder, title, status indicator, or dialog text.** The only occurrences of "Working" in the entire codebase are in markdown documentation (CHANGELOG, AGENT.md, etc.) where it means "working tree" or "working on this codebase".

The "Working" text the user is seeing must be coming from **outside** the `pi-ask-user-glimpse` extension. The two most likely sources are:

1. **The `pi-heading` extension's working-message indicator** — `pi-heading` calls `ctx.ui.setWorkingMessage()` during `agent_start`/`turn_start` with the agent's goal text. The `pi-ask-user-glimpse` extension never updates this working message when the dialog opens, so the Pi UI status bar continues showing whatever the agent was last "working" on.
2. **The `summarizeTitle()` function extracting "Working" from the user's question** — if the user's question contains only one non-stopword (e.g., "Are you working?", "What is working?"), the window title becomes literally "Working" because "Are", "you", "is", "what" are all in the `STOPWORDS` set.

---

## Key Findings

### 1. No "Working" text in pi-ask-user-glimpse source

**Search result:** `grep -ri "Working"` across all `.ts`, `.tsx`, `.js`, `.html`, `.css` files in the package returns **zero matches** in source code.

Only matches are in markdown files:
- `AGENT.md` line 7: "Behavioral rules for AI agents **working** on this codebase"
- `CHANGELOG.md` line 155: "jj colocated **working** copy was silently reset"
- `CHANGELOG.md` line 197: "Jujutsu **working** directory ignored"

### 2. Window title construction: `tool/ask-user.ts` (lines 181–188)

```typescript
// tool/ask-user.ts
const sessionName = ctx.sessionManager.getSessionName();
const questionTitle = summarizeTitle(params.question);
const title = sessionName
    ? `Pi · ${sessionName} · ${questionTitle}`
    : `Pi · ${questionTitle}`;

const windowOptions: Record<string, unknown> = {
    width: 1200,
    height: 900,
    title: title.length > 60 ? `${title.slice(0, 57)}…` : title,
};

const rawResult = (await prompt(html, { ...windowOptions, timeout: 120000 })) as unknown;
```

The title is passed to `glimpseui.prompt()` via `windowOptions.title`. The `glimpseui` library forwards it to the native binary as a `--title` CLI argument.

### 3. `summarizeTitle()` can produce "Working" for certain questions

**File:** `tool/ask-user.ts` (lines 23–47)

```typescript
function summarizeTitle(question: string, maxWords = 3): string {
    const contentWords = question
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 0 && !STOPWORDS.has(w));

    if (contentWords.length === 0) {
        const words = question.trim().split(/\s+/);
        return words.slice(0, 5).join(" ") + (words.length > 5 ? "…" : "");
    }

    const result = contentWords
        .slice(0, maxWords)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

    return contentWords.length > maxWords ? `${result}…` : result;
}
```

**`STOPWORDS` includes:** `are`, `you`, `is`, `what`, `the`, `on`, `this`, `for`, `in`, `to`, `of`, `a`, `an`, `the`, `do`, `does`, `did`, `will`, `would`, `could`, `should`, `may`, `might`, `must`, `shall`, `can`, `have`, `has`, `had`, `be`, `been`, `being`, `it`, `its`, `we`, `our`, `your`, `they`, `their`, `them`, `he`, `him`, `his`, `she`, `her`, `i`, `me`, `my`, `mine`, `us`, `and`, `but`, `if`, `or`, `because`, `until`, `while`, `which`, `what`, `who`, `whom`, `this`, `that`, `these`, `those`, `am`, `any`, `both`, `either`, `neither`, `one`, `two`, `first`, `last`, `another`, `every`, `many`, `much`, `several`, `let`, `new`, `use`, `using`, `make`, `made`, `get`, `got`, `go`, `going`, `want`, `wanted`, `like`, `liked`, `know`, `knew`, `known`, `think`, `thought`, `see`, `saw`, `seen`, `come`, `came`, `give`, `gave`, `given`, `take`, `took`, `taken`, `find`, `found`, `say`, `said`, `tell`, `told`, `ask`, `asked`, `work`, `worked`, `seem`, `seemed`, `feel`, `felt`, `try`, `tried`, `leave`, `left`, `call`, `called`, `good`, `well`, `better`, `best`, `bad`, `worse`, `worst`, `old`, `long`, `great`, `little`, `right`, `left`, `big`, `high`, `different`, `important`, `same`, `able`, `next`, `early`, `young`, `public`, `free`, `real`, `easy`, `clear`, `recent`, `local`, `social`, `full`, `small`, `large`, `possible`, `particular`, `available`, `special`, `certain`, `personal`, `open`, `general`, `enough`, `probably`, `actually`, `especially`, `finally`, `usually`, `perhaps`, `almost`, `simply`, `quickly`, `recently`, `already`, `eventually`, `suddenly`, `certainly`, `definitely`, `absolutely`, `completely`, `totally`, `entirely`, `exactly`, `specifically`, `particularly`, `especially`, `mainly`, `mostly`, `partly`, `fully`, `nearly`, `quite`, `rather`, `pretty`, `fairly`, `really`, `even`, `still`, `yet`, `ever`, `never`, `always`, `sometimes`, `often`, `usually`, `frequently`, `rarely`, `generally`, `typically`, `normally`, `largely`, `potentially`, `theoretically`, `practically`, `basically`, `essentially`, `fundamentally`, `primarily`, `chiefly`, `principally`, `partially`, `half`, `quarter`, `double`, `single`, `multiple`, `various`, `hundred`, `thousand`, `million`, `billion`.

**Note:** `"work"` and `"worked"` ARE in the stopwords list, but `"working"` is NOT.

**Scenarios where `summarizeTitle` returns exactly `"Working"`:**
- Question: `"Are you working?"` → stopwords: `are`, `you` → content words: `["working"]` → title: `"Working"`
- Question: `"What is working?"` → stopwords: `what`, `is` → content words: `["working"]` → title: `"Working"`
- Question: `"Is working?"` → stopwords: `is` → content words: `["working"]` → title: `"Working"`

**This is the most likely cause if the user sees "Working" in the window title bar.**

### 4. `glimpseui.prompt()` does NOT call `show()` — title is only set via CLI arg

**File:** `node_modules/glimpseui/src/glimpse.mjs` (lines 282–311)

```javascript
export function prompt(html, options = {}) {
  return new Promise((resolve, reject) => {
    const win = open(html, { ...options, autoClose: true });
    // ...
    // NO win.show() call here!
  });
}
```

The `open()` function passes the title as `--title` CLI argument:
```javascript
if (options.title != null)  args.push('--title',  options.title);
```

The native binary (Swift, Rust, .NET) reads this and sets `window.title = config.title`. The `show()` method (which can update the title dynamically) is **never called** by `prompt()`. This means:
- The title is set once at window creation time
- There is no dynamic title update after the window opens

### 5. No "Working" in any dialog component

| Component | Has "Working"? | Relevant text |
|-----------|------------------|---------------|
| `ContextPanel.tsx` | ❌ | Renders `question` and `context` |
| `SelectDialog.tsx` | ❌ | Renders options, "No options available", "Submitting…" |
| `Freeform.tsx` | ❌ | Placeholder: "Type your answer…" |
| `Questionnaire.tsx` | ❌ | Shows "N of M answered" |
| `DialogFooter.tsx` | ❌ | Shows "Submitting…" or "Submit" |
| `OptionCard.tsx` | ❌ | Renders option title + description |
| `QuestionCard.tsx` | ❌ | Renders question title + options |
| `CancelConfirmModal.tsx` | ❌ | "Unsaved changes" |
| `useBaseDialog.tsx` | ❌ | No text rendering |
| `index.html` | ❌ | `<title>Ask User</title>` |

### 6. "Working" text exists in `pi-heading` extension (same monorepo)

**File:** `packages/pi-heading/ui/widget.ts` (lines 6, 26, 30)

```typescript
export type WidgetMode = "goal" | "working" | "achievement" | "idle";

export function setHeadingMessage(ctx, text, mode = "goal") {
  const trimmed = text.trim();
  if (!trimmed || mode === "idle") {
    clearHeading(ctx);
    return;
  }
  ctx.ui.setWorkingMessage(trimmed);
}
```

**File:** `packages/pi-heading/index.ts` (lines 259, 268, 280)

```typescript
pi.on("agent_start", (_event, ctx) => {
  // ...
  setHeadingMessage(ctx, state.goal, "working");
});

pi.on("turn_start", (_event, ctx) => {
  // ...
  setHeadingMessage(ctx, state.goal, "working");
});
```

The `pi-heading` extension sets the Pi UI's working message to the agent's goal during `agent_start` and `turn_start`. The `pi-ask-user-glimpse` extension does **not** update or clear this working message when the `ask_user` dialog opens. The Pi UI's status bar/heading may continue showing "Working" (or the goal text) while the dialog is open.

### 7. `glimpseui` default title is "Glimpse", not "Working"

**File:** `node_modules/glimpseui/src/glimpse.swift` (line 124)
```swift
struct Config {
    var title: String = "Glimpse"
    // ...
}
```

**File:** `node_modules/glimpseui/src/chromium-backend.mjs` (line 36)
```javascript
const config = {
    title: 'Glimpse',
    // ...
};
```

If the `--title` argument were completely ignored, the window would show "Glimpse", not "Working".

---

## Architecture: How the pieces connect

```
User's question
    ↓
tool/ask-user.ts: askUserHandler()
    ├── summarizeTitle(params.question) → "Working" (if only 1 non-stopword)
    ├── windowOptions.title = "Pi · {sessionName} · {questionTitle}"
    └── await prompt(html, { ...windowOptions, timeout: 120000 })
            ↓
        glimpseui/src/glimpse.mjs: prompt()
            └── open(html, { ...options, autoClose: true })
                    └── spawn native_binary, args: [..., '--title', 'Pi · ... · Working']
                            ↓
                        macOS: src/glimpse.swift
                            └── window.title = config.title  // from --title CLI arg
                        Linux: src/chromium-backend.mjs
                            └── document.title = config.title  // from --title CLI arg
                        Windows: native/windows/Program.cs
                            └── window.Title = config.title
```

**The dialog content (question, options, context) is rendered by React in the webview.** The window title is a separate native OS concept. The `pi-ask-user-glimpse` extension never manipulates `document.title` inside the webview — it relies entirely on the `glimpseui` `--title` CLI argument.

---

## Files That Likely Need Changes

| File | Why | Line Range |
|------|-----|------------|
| `tool/ask-user.ts` | Title construction and `summarizeTitle()` logic | 23–47, 181–188 |
| `index.ts` | Extension lifecycle — could add `ctx.ui.setWorkingMessage()` to clear/update the Pi heading when `ask_user` opens | 166–187 (if adding heading integration) |
| `types/glimpseui.d.ts` | Type definitions for `glimpseui` — no changes needed, but relevant for understanding the API | 1–50 |
| `webview/index.html` | Default `<title>Ask User</title>` — could be updated to set `document.title` dynamically from the payload | 6–10 |
| `webview/src/main.tsx` | Entry point — could read `payload.question` and set `document.title` dynamically | 1–30 |

---

## Constraints, Risks, and Open Questions

1. **The `summarizeTitle()` function is designed for window titles, not for displaying the full question.** The full question is already rendered prominently in the `ContextPanel` and dialog body. If the user expects the window title to be the full question, the current design intentionally truncates it. Changing this would require either:
   - Increasing `maxWords` in `summarizeTitle`
   - Using the full `params.question` as the title (risk: very long titles get truncated by OS or `glimpseui`)
   - Setting `document.title` dynamically in the webview to match the full question

2. **The `glimpseui` library's `prompt()` function does not call `show()`.** This means the title cannot be updated after the window opens. If the title needs to be dynamic, the fix must be in the title passed at creation time, or `glimpseui` itself needs to be modified.

3. **The `pi-heading` extension controls the Pi UI's working message independently.** If the user's complaint is about the Pi status bar (not the window title), the fix would need to be in `pi-ask-user-glimpse` calling `ctx.ui.setWorkingMessage()` or `setHeadingMessage()` when the dialog opens/closes. However, this creates a cross-extension dependency.

4. **Open question:** Is the user seeing "Working" in:
   - The **macOS window title bar**? → Likely `summarizeTitle()` extracting "Working"
   - The **Pi conversation/status UI**? → Likely `pi-heading` working message
   - The **dialog content**? → Impossible; no "Working" text exists in dialog components

5. **Risk:** If `summarizeTitle()` is changed to never return single-word titles, it might still return something unexpected for questions like "Are you working on this?" ("Working Right Now"). The real fix might be to use the full question (truncated to 60 chars) as the window title instead of a summarized version.

---

## Start Here

**First file to open:** `tool/ask-user.ts` (lines 23–47)

This is where `summarizeTitle()` is defined and where the window title is constructed. If the user's question is being reduced to a single word like "Working", this is the code responsible. The `summarizeTitle()` function and the title construction logic are the most likely culprits for a window title showing "Working".

**Second file to open:** `pi-heading/index.ts` (lines 259–281)

If the issue is about the Pi UI's status bar/heading message, this is where the working message is set. The `pi-ask-user-glimpse` extension might need to integrate with `pi-heading` or call `ctx.ui.setWorkingMessage()` directly to clear/update the heading when the dialog is open.

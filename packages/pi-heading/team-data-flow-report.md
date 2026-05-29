# Data Flow Analysis Report

**Issue:** "it is still showing Working instead of my message"  
**Packages reviewed:** `pi-ask-user-glimpse` (as requested) and `pi-heading` (current working directory)  
**Date:** 2026-05-28

---

## Executive Summary

The literal string **"Working"** does not appear anywhere in the `pi-ask-user-glimpse` source code, webview, or dialog components. The only place where a default "Working" indicator is referenced is in the **`pi-heading`** package — specifically via the Pi platform's native `ctx.ui.setWorkingMessage()` API and `setWorkingVisible()` loader. After tracing the complete data flow, the most probable root cause is an **interaction bug between `setWorkingMessage()` and `setWorkingVisible(true)` in `pi-heading`**, where the latter may reset the custom message back to the platform default "Working" text.

Below is the full trace for both packages as requested.

---

## 1. Data Flow: `pi-ask-user-glimpse` — `askUserHandler` → Rendered Dialog

### 1.1 Payload Construction (`tool/ask-user.ts`)

**File:** `packages/pi-ask-user-glimpse/tool/ask-user.ts`  
**Lines:** 89–137

```typescript
let question = params.question;
let context = params.context;
if (!context && params.question.length > 120) {
    const match = params.question.match(/^(.+?[.?!])(\s+|$)/);
    if (match && match[0].length < params.question.length) {
        question = match[1].trim();
        context = params.question.slice(match[0].length).trim();
    }
}

const payload: AskUserPayload = {
    type: payloadType,
    question,          // ← user's message (or first sentence if auto-split)
    context,
    ...
};
```

**Finding:** `payload.question` is always set to `params.question` (or its first sentence after auto-split). There is no default/placeholder value like "Working" injected here.

### 1.2 HTML Injection

**File:** `packages/pi-ask-user-glimpse/tool/ask-user.ts`  
**Lines:** 139–146

```typescript
const html = baseHtml.replace(
    "/*ASK_USER_PAYLOAD*/",
    JSON.stringify(payload)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026"),
);
```

**Potential Failure Point #1 — Build-time placeholder loss:**

The source `webview/index.html` contains the placeholder inside a `<script>` block comment:

```html
<script>
  window.__ASK_USER_PAYLOAD__ = /*ASK_USER_PAYLOAD*/;
</script>
```

The build uses `vite-plugin-singlefile` (`vite.config.ts`). If the Vite HTML pipeline strips or minifies away this block comment during the single-file inlining process, the `replace()` call will silently fail. The resulting HTML would contain a JavaScript syntax error (`window.__ASK_USER_PAYLOAD__ = /* ... */ ;` with no right-hand expression), which would crash the script block and leave `window.__ASK_USER_PAYLOAD__` undefined.

**Evidence:** `dist/index.html` does not exist in the repo at the time of review; we cannot verify the build output.

**Recommendation:** Verify the built `dist/index.html` still contains `/*ASK_USER_PAYLOAD*/` verbatim, or switch to a `<meta>` tag or `data-attribute` placeholder that is immune to JS minification.

### 1.3 Webview Payload Consumption

**File:** `packages/pi-ask-user-glimpse/webview/src/main.tsx` (line 7) and `webview/src/App.tsx` (line 14)

```typescript
// main.tsx
const raw = (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__;

// App.tsx
function getPayload(): AskUserPayload {
    const raw = (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__;
    if (!raw || typeof raw !== "object") {
        throw new Error("Missing or invalid ask_user payload");
    }
    return raw as AskUserPayload;
}
```

**Potential Failure Point #2:** If `window.__ASK_USER_PAYLOAD__` is `undefined` (e.g., because the injection failed), the React app renders an error screen: `"Missing or invalid ask_user payload"`. This is **not** the "Working" text, but it would prevent the user's message from appearing.

### 1.4 Propagation to ContextPanel

**File:** `packages/pi-ask-user-glimpse/webview/src/App.tsx`  
**Lines:** 127–132

```tsx
<ContextPanel
    context={payload.context ?? ""}
    contextFormat={payload.contextFormat}
    question={payload.question}
/>
```

**Finding:** `payload.question` is passed directly as the `question` prop. No transformation or replacement occurs.

### 1.5 ContextPanel Rendering

**File:** `packages/pi-ask-user-glimpse/webview/src/components/ContextPanel.tsx`  
**Lines:** 194–213

```tsx
{question && (
    <div className="shrink-0 border-b border-border bg-card/50">
        <div className="flex items-start justify-between p-4 gap-3">
            <div className="flex items-start gap-2 flex-1 min-w-0">
                <span ...>❝</span>
                <div
                    className="text-base font-semibold text-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{
                        __html: renderMarkdownInline(question),
                    }}
                />
            </div>
            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                <SettingsButton />
            </div>
        </div>
    </div>
)}
```

**Potential Failure Point #3 — Conditional guard:**

If `payload.question` is an empty string (`""`), `null`, or `undefined`, the `question &&` guard evaluates to `false` and the entire question block is **not rendered**. The user would see the context panel with no question header. The tool schema (`index.ts`) defines `question` as `Type.String()`, so it should always be a non-empty string, but a malformed agent call could bypass this.

**Potential Failure Point #4 — CSS/styling:**

The question text uses `text-foreground` (color: `hsl(var(--foreground))`). The surrounding container has `bg-card/50`. There is no CSS rule that would hide the text or replace it with "Working". The CSS (`index.css`) defines standard light/dark color variables and does not contain any placeholder text or `content` pseudo-element rules.

### 1.6 Markdown Rendering Pipeline

**File:** `packages/pi-ask-user-glimpse/webview/src/util/markdown.ts`  
**Lines:** 72–78

```typescript
export function renderMarkdownInline(text: string): string {
    const html = renderMarkdown(text);
    // marked wraps inline content in <p>...</p>; strip it for inline contexts
    return html.replace(/^<p>(.*)<\/p>\s*$/s, "$1");
}
```

**Potential Failure Point #5 — Text stripping:**

`renderMarkdownInline` calls `marked.parse(text)` then strips the outer `<p>` tags. If the question text is wrapped in additional HTML by `marked` (e.g., if it contains block-level markdown), the regex `^<p>(.*)</p>\s*$` might not match, and the raw HTML would be returned. However, this would still render the user's message, not "Working".

**Potential Failure Point #6 — Sanitizer over-stripping:**

`renderMarkdown` runs `sanitizeHtml()` via DOMPurify. The sanitizer config strips `<script>`, `<img>`, `<iframe>`, `<style>`, `<form>`, `<svg>`, `<math>`, `<link>`, `<meta>`, and `<noscript>` tags. It does **not** strip plain text. There is no rule that would replace the user's message with a placeholder.

---

## 2. Data Flow: `pi-heading` — `setWorkingMessage` → "Working"

Because the literal "Working" text is not present in `pi-ask-user-glimpse`, the issue must originate in the `pi-heading` package (which is in the current working directory and uses the Pi platform's working indicator API).

### 2.1 Core API Usage

**File:** `packages/pi-heading/ui/widget.ts`  
**Lines:** 15–31

```typescript
export function setHeadingMessage(
  ctx: ExtensionContext,
  text: string,
  mode: WidgetMode = "goal",
): void {
  const trimmed = text.trim();
  if (!trimmed || mode === "idle") {
    clearHeading(ctx);
    return;
  }
  ctx.ui.setWorkingMessage(trimmed);
}

export function clearHeading(ctx: ExtensionContext): void {
  ctx.ui.setWorkingMessage();
}
```

**Critical Finding:** `clearHeading()` calls `ctx.ui.setWorkingMessage()` with **zero arguments**.

If the Pi platform's native implementation treats `setWorkingMessage()` with no arguments as "reset to default text", the default text is **"Working"**. This means every call to `clearHeading()` will replace the custom message with "Working".

### 2.2 Event Handler Sequence

**File:** `packages/pi-heading/index.ts`  
**Lines:** 133–189

```typescript
pi.on("agent_end", (_event, ctx) => {
    if (!ctx.hasUI) return;
    agentStartedForCurrentTurn = false;
    const leafId = ctx.sessionManager.getLeafId();
    const state = leafId ? getState(leafId) : undefined;
    if (state?.goal) {
        const mode = state.achievement ? "achievement" : "goal";
        setHeadingMessage(ctx, state.goal, mode);   // ← sets custom goal text
        exposeHeading(pi, state, mode);
    } else {
        clearHeading(ctx);                           // ← resets to "Working"
        clearExposure(pi);
    }
    ctx.ui.setWorkingVisible(true);                   // ← potential reset
});

pi.on("session_shutdown", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    clearHeading(ctx);                               // ← resets to "Working"
    ctx.ui.setWorkingVisible(true);                  // ← potential reset
    clearExposure(pi);
});
```

**Potential Failure Point #7 — `setWorkingVisible(true)` reset:**

In `agent_end`, `setHeadingMessage(ctx, state.goal, mode)` is called **before** `ctx.ui.setWorkingVisible(true)`. If the Pi platform's native `setWorkingVisible(true)` implementation **resets the working message text to its default** ("Working") as a side effect, then the custom goal text is immediately overwritten.

The ADR (`docs/adr/0002-widget-phase-indicators.md`) explicitly states:

> "Pi also provides a native `ctx.ui.setWorkingMessage()` loading indicator, but it lives in Pi's own status area..."
> "Suppress Pi's native loader. When the widget spinner is active, `ctx.ui.setWorkingVisible(false)` hides Pi's built-in 'Working...' row."

However, the current `pi-heading` code **never calls `setWorkingVisible(false)`**. It only calls `setWorkingVisible(true)` in `agent_end` and `session_shutdown`. The ADR describes the intended behavior, but the implementation appears to have diverged.

### 2.3 First-Turn Race Condition

**File:** `packages/pi-heading/index.ts`  
**Lines:** 97–160

```typescript
pi.on("before_agent_start", (event, ctx) => {
    const prompt = event.prompt?.trim();
    if (!prompt || !ctx.hasUI) return;
    const myGeneration = ++turnGeneration;
    agentStartedForCurrentTurn = false;
    // ...
    void (async () => {
        const result = await summarize(ctx, prompt);
        // ...
        const mode = agentStartedForCurrentTurn ? "working" : "goal";
        setHeadingMessage(ctx, result.goal, mode);
    })();
});

pi.on("agent_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    agentStartedForCurrentTurn = true;
    const leafId = ctx.sessionManager.getLeafId();
    const state = leafId ? getState(leafId) : undefined;
    if (state?.goal) {
        setHeadingMessage(ctx, state.goal, "working");
    }
});
```

**Potential Failure Point #8 — Empty state on first turn:**

On a fresh session with no replayed state:
1. `session_start` → `clearHeading()` → `setWorkingMessage()` → default "Working"
2. `before_agent_start` → starts async summarize (no immediate `setWorkingMessage`)
3. `agent_start` → `state?.goal` is `undefined` → **does nothing** → platform still shows "Working"
4. Summarize completes → `setHeadingMessage(ctx, result.goal, ...)` → finally shows goal text

During steps 2–3, the user sees the platform default "Working" because the heading has been cleared and the state hasn't been populated yet. The async gap can be hundreds of milliseconds (or longer if the LLM is slow), during which the user perceives "Working" instead of the intent message.

### 2.4 `summarize` Returning Empty Goal

**File:** `packages/pi-heading/llm/summarize.ts`  
**Lines:** 170–180

```typescript
export async function summarize(ctx, message): Promise<SummarizeResult> {
    const [topicResult, goalResult] = await Promise.all([
        runPrompt(ctx, "topic", message),
        runPrompt(ctx, "goal", message),
    ]);
    return {
        topic: topicResult.text,
        goal: goalResult.text,
        ...
    };
}
```

**Potential Failure Point #9 — Empty goal from LLM:**

If the LLM returns an empty or whitespace-only `goal`, `index.ts` line 123–126:

```typescript
if (!result.goal.trim()) {
    logDebug(...);
    return;
}
```

This returns **without calling `setHeadingMessage`**. The platform continues showing whatever was there before — which could be the default "Working" from `session_start` or `agent_start`.

---

## 3. Cross-Package Confusion

The task description references `pi-ask-user-glimpse` and `askUserHandler`, but the literal "Working" text does not exist in that package. The current working directory (`pi-heading`) is the package that manipulates the Pi working indicator via `setWorkingMessage()`. It is highly likely that:

- The **actual issue is in `pi-heading`**, not `pi-ask-user-glimpse`.
- The `pi-ask-user-glimpse` data flow is healthy (no "Working" string, no hidden question replacement logic).
- The `pi-heading` extension has a bug where the platform default "Working" text is not being properly overridden.

---

## 4. Recommendations

### For `pi-heading` (root cause of "Working")

1. **Verify `setWorkingMessage()` argument behavior:** Confirm whether `ctx.ui.setWorkingMessage()` with no arguments resets the text to "Working". If so, `clearHeading()` should pass an empty string or a space to avoid the default.
2. **Reorder `setWorkingVisible(true)`:** Move `ctx.ui.setWorkingVisible(true)` **before** `setHeadingMessage()` in `agent_end`, or verify that `setWorkingVisible` does not reset the message text. If it does, the fix is to set the message again after making the indicator visible.
3. **Set an immediate placeholder on `before_agent_start`:** Before firing the async summarize, set a temporary working message like `setHeadingMessage(ctx, "Thinking...", "working")` so the user never sees the platform default "Working".
4. **Handle empty goal gracefully:** When `result.goal.trim()` is empty, set a fallback message (e.g., the original prompt or "Analyzing...") instead of leaving the previous/default text.
5. **Restore `setWorkingVisible(false)` during agent execution:** As described in ADR 0002, call `setWorkingVisible(false)` during `agent_start` to suppress the native loader, and restore it at `agent_end`.

### For `pi-ask-user-glimpse` (build robustness)

1. **Verify build output:** Ensure `dist/index.html` still contains the `/*ASK_USER_PAYLOAD*/` placeholder after the Vite single-file build.
2. **Switch to a safer placeholder:** Use a `<script type="application/json" id="payload">` tag or a `data-payload` attribute on the `<body>` element, which is immune to JS minification and comment stripping.
3. **Add a replacement verification:** After `baseHtml.replace()`, assert that the payload was actually injected (e.g., `html.includes(JSON.stringify(payload).slice(0, 20))`). If not, throw a clear error before opening the dialog.

---

## 5. Conclusion

After tracing every stage of the data flow:

- **No evidence** was found in `pi-ask-user-glimpse` of a "Working" placeholder or of the user's message being hidden/replaced.
- **Strong evidence** was found in `pi-heading` that the platform default "Working" text is being shown because:
  - `clearHeading()` calls `setWorkingMessage()` with no arguments, which may reset to default.
  - `setWorkingVisible(true)` may be resetting the custom message text.
  - On first turns, there is a race condition where no state exists and the async summarize hasn't completed, leaving the default "Working" visible.
  - Empty LLM responses bypass the `setHeadingMessage` call entirely.

The issue is most likely a **platform API interaction bug in `pi-heading`**, not a data-flow bug in `pi-ask-user-glimpse`.

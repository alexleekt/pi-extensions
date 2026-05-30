# Team Glimpse Integration Report — "Working instead of my message"

## Issue Summary

User reports: *"it is still showing Working instead of my message"* in `pi-ask-user-glimpse`. The word **"Working"** does not appear anywhere in the package's source code, HTML, CSS, or test files. This means it is either:

1. Produced by the `summarizeTitle()` function from the user's question text, or
2. A default/native title from the GlimpseUI layer when the `title` option is not consumed correctly.

---

## 1. Code Flow: From `ask_user` Call to Rendered Dialog

### Step A: Server-side title construction (`tool/ask-user.ts`)

```typescript
tool/ask-user.ts:181
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

- `prompt` is imported from `glimpseui` (line 6).
- The `html` argument is the full bundled webview HTML (from `dist/index.html`) with the `/*ASK_USER_PAYLOAD*/` placeholder replaced with the JSON payload.
- The `title` property is inside the second argument (`options`).

### Step B: `summarizeTitle()` — the stopword filter

```typescript
tool/ask-user.ts:23
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

- The function aggressively removes ~200 stopwords (including `a`, `an`, `the`, `is`, `are`, `was`, `were`, `be`, `been`, `being`, `have`, `has`, `had`, `do`, `does`, `did`, `will`, `would`, `could`, `should`, `may`, `might`, `must`, `shall`, `can`, `need`, `ought`, `used`, `to`, `of`, `in`, `for`, `on`, `with`, `at`, `by`, `from`, `as`, `into`, `through`, `during`, `before`, `after`, `above`, `below`, `between`, `under`, `again`, `further`, `then`, `once`, `here`, `there`, `when`, `where`, `why`, `how`, `all`, `each`, `few`, `more`, `most`, `other`, `some`, `such`, `no`, `nor`, `not`, `only`, `own`, `same`, `so`, `than`, `too`, `very`, `just`, `and`, `but`, `if`, `or`, `because`, `until`, `while`, `which`, `what`, `who`, `whom`, `this`, `that`, `these`, `those`, `am`, `it`, `its`, `we`, `our`, `you`, `your`, `they`, `their`, `them`, `he`, `him`, `his`, `she`, `her`, `i`, `me`, `my`, `mine`, `us`, `any`, `both`, `either`, `neither`, `one`, `two`, `first`, `last`, `another`, `every`, `many`, `much`, `several`, `let`, `new`, `use`, `using`, `make`, `made`, `get`, `got`, `go`, `going`, `want`, `wanted`, `like`, `liked`, `know`, `knew`, `known`, `think`, `thought`, `see`, `saw`, `seen`, `come`, `came`, `give`, `gave`, `given`, `take`, `took`, `taken`, `find`, `found`, `say`, `said`, `tell`, `told`, `ask`, `asked`, `work`, `worked`, `seem`, `seemed`, `feel`, `felt`, `try`, `tried`, `leave`, `left`, `call`, `called`, `good`, `well`, `better`, `best`, `bad`, `worse`, `worst`, `old`, `long`, `great`, `little`, `right`, `left`, `big`, `high`, `different`, `important`, `same`, `able`, `next`, `early`, `young`, `public`, `free`, `real`, `easy`, `clear`, `recent`, `local`, `social`, `full`, `small`, `large`, `possible`, `particular`, `available`, `special`, `certain`, `personal`, `open`, `general`, `enough`, `probably`, `actually`, `especially`, `finally`, `usually`, `perhaps`, `almost`, `simply`, `quickly`, `recently`, `already`, `eventually`, `suddenly`, `certainly`, `definitely`, `absolutely`, `completely`, `totally`, `entirely`, `exactly`, `specifically`, `particularly`, `especially`, `mainly`, `mostly`, `partly`, `fully`, `nearly`, `quite`, `rather`, `pretty`, `fairly`, `really`, `even`, `still`, `yet`, `ever`, `never`, `always`, `sometimes`, `often`, `usually`, `frequently`, `rarely`, `generally`, `typically`, `normally`, `largely`, `potentially`, `theoretically`, `practically`, `basically`, `essentially`, `fundamentally`, `primarily`, `chiefly`, `principally`, `partially`, `half`, `quarter`, `double`, `single`, `multiple`, `various`, `hundred`, `thousand`, `million`, `billion`).

**Key observation:** `work` and `worked` are in the stopword list, but **"working" is NOT**. If a user's question is *"What are you working on?"*, after stopword removal the only remaining word is `"working"`. The title becomes **"Working"**. This is a very plausible origin of the reported bug.

### Step C: `GlimpseWindowOptions` and `prompt()` signature

```typescript
types/glimpseui.d.ts:5
export interface GlimpseWindowOptions {
    width?: number;
    height?: number;
    title?: string;
    frameless?: boolean;
    floating?: boolean;
    transparent?: boolean;
    clickThrough?: boolean;
    noDock?: boolean;
    hidden?: boolean;
    autoClose?: boolean;
    openLinks?: boolean;
    openLinksApp?: string;
    followCursor?: boolean;
    x?: number;
    y?: number;
    cursorOffset?: { x?: number; y?: number };
    cursorAnchor?: string;
    followMode?: "snap" | "spring";
    timeout?: number;
}

types/glimpseui.d.ts:38
export function prompt(
    html: string,
    options?: GlimpseWindowOptions,
): Promise<unknown | null>;
```

- The `prompt` function accepts `GlimpseWindowOptions` which includes `title?: string`.
- **However**, `prompt` returns a `Promise`, not a `GlimpseWindow` object.
- The `GlimpseWindow` interface has a separate `show(options?: { title?: string }): void` method (line 30), but since `prompt` returns a `Promise`, there is no way to call `show` after the fact to set or override the title.
- If the native `prompt` implementation does not internally pass the `title` option through to the window creation, the title will never be applied.
- The `glimpseui.d.ts` is **hand-written** (confirmed by AGENT.md and CHANGELOG). The types may not perfectly reflect the runtime behavior of `glimpseui@0.8.1`.

### Step D: Webview HTML (`webview/index.html`)

```html
webview/index.html:17
<title>Ask User</title>
```

- The webview HTML title is **"Ask User"**, not "Working".
- The GlimpseUI native host might use the HTML `<title>` as a fallback if the `options.title` is not consumed. But the fallback here is "Ask User", not "Working".

### Step E: React entry point (`webview/src/main.tsx`)

```typescript
webview/src/main.tsx:7
const raw = (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__;
const payload = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

// ... renders <App /> inside <SettingsProvider>
```

- `main.tsx` reads the payload from `window.__ASK_USER_PAYLOAD__` and passes it to `App`.
- There is no logic here that modifies or hides the `question`.

### Step F: App layout (`webview/src/App.tsx`)

```typescript
webview/src/App.tsx:126
<div className="flex h-screen flex-col overflow-hidden">
    <div className="flex flex-1 overflow-hidden">
        {/* Left panel — ContextPanel with question + context */}
        <div ...>
            <ContextPanel
                context={payload.context ?? ""}
                contextFormat={payload.contextFormat}
                question={payload.question}
            />
        </div>
        {/* Right panel — dialog body (options, textarea, etc.) */}
        <div className="flex flex-1 flex-col overflow-hidden">
            {renderComponent(componentPayload)}
        </div>
    </div>
    {/* Footer — full width */}
    <div ...>{footerNode}</div>
</div>
```

- `App.tsx` renders the `payload.question` **only inside the left panel (`ContextPanel`)**.
- The right panel (`renderComponent`) does **not** render the `payload.question` anywhere.
- `componentPayload` is `({ ...payload, context: undefined })` — it still contains `question`, but the dialog components (`SelectDialog`, `Freeform`, `Questionnaire`) ignore `payload.question` in their rendering.
- The left panel is **not collapsed by default** (`isCollapsed` starts as `false`).

### Step G: `ContextPanel` rendering (`webview/src/components/ContextPanel.tsx`)

```tsx
webview/src/components/ContextPanel.tsx:192
{question && (
    <div className="shrink-0 border-b border-border bg-card/50">
        <div className="flex items-start justify-between p-4 gap-3">
            <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className="text-muted-foreground text-sm leading-none mt-1 select-none" aria-hidden="true">
                    ❝
                </span>
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

- The `question` is rendered using `renderMarkdownInline(question)` which strips the wrapping `<p>` tag from `marked`'s output.
- The `renderMarkdownInline` function does not strip the actual text content — it only removes the HTML `<p>` wrapper.
- The question is displayed with a ❝ quote mark and a `SettingsButton` (⚙️) on the right.

---

## 2. Where "Working" Could Come From

### Possibility A: `summarizeTitle()` produces it from the user's question

If the user's question is *"What are you working on?"*, the stopword filter removes everything except `"working"`. The window title becomes `Pi · {sessionName} · Working`. The user sees **"Working"** in the native window title bar and believes it is the dialog's "message".

**Evidence:**
- `STOPWORDS` contains 200+ common English words but **not "working"**.
- `summarizeTitle` is called with `maxWords = 3` by default.
- The title is passed to `prompt()` via `windowOptions.title`.

### Possibility B: GlimpseUI `prompt()` ignores the `title` option

If `glimpseui@0.8.1` does not use the `title` property from `GlimpseWindowOptions` in the `prompt()` function, the native window may show a default title. The word "Working" could be a system default or a leftover from the native host's internal state.

**Evidence:**
- "Working" does **not** exist in the codebase at all (grep returned no matches).
- The `glimpseui.d.ts` types are hand-written; the AGENT.md explicitly notes that other APIs (custom window icons) "do not exist in v0.8.1".
- The `prompt` function returns a `Promise` (not a `GlimpseWindow`), so there is no post-creation `show({ title })` hook available.

### Possibility C: Both

The `summarizeTitle` produces a poor title ("Working"), and the `prompt` function does not use it anyway. The native window shows a default title, and the user sees either "Working" from the native layer or nothing related to their question.

---

## 3. Potential Issues in the Code Flow

### Issue 1: `summarizeTitle` is too aggressive for short/medium questions

For questions that are mostly stopwords, the resulting title can be a single nonsensical word (e.g., "Working", "Going", "Think"). The title no longer reflects the user's intent.

**Location:** `tool/ask-user.ts:23`  
**Impact:** Window title bar shows a poor summary that the user may interpret as the "message".

### Issue 2: The `payload.question` is not rendered in the main dialog area

`SelectDialog`, `Freeform`, and `Questionnaire` do **not** display `payload.question` in the right panel. The question is only visible in the left `ContextPanel`.

**Impact:** If the user collapses the left panel (double-click the resizer), the question disappears entirely. The only place the question is visible is the native window title — which is either summarized (possibly to "Working") or ignored by the native layer.

### Issue 3: The `prompt` function's `title` support is unverified at runtime

The code assumes `prompt(html, { title })` will set the window title. There is no runtime verification or fallback. The `glimpseui.d.ts` types are hand-written, and the native library may not consume the `title` option for the `prompt` convenience function.

**Impact:** The title may be silently ignored, and the native window may show a default title or no title at all.

---

## 4. Recommendations

### Immediate fix: Replace `summarizeTitle` with a first-sentence or first-N-words approach

Instead of stopword filtering, use the first sentence (or first 5-7 words) of the question as the title. This preserves the user's intent and avoids single-word nonsensical titles like "Working".

```typescript
// Alternative: first sentence, capped at 60 chars
function questionTitle(question: string): string {
    const firstSentence = question.match(/^(.+?[.?!])(\s+|$)/);
    const candidate = firstSentence ? firstSentence[1].trim() : question.trim();
    return candidate.length > 60 ? `${candidate.slice(0, 57)}…` : candidate;
}
```

### Medium fix: Render the `payload.question` in the main dialog area

Add a question header to `SelectDialog`, `Freeform`, and `Questionnaire` so the question is visible even when the left panel is collapsed. This aligns with the README's claim: *"Prominent question header — full non-truncated question text in the header bar"*.

### Verification fix: Confirm `prompt` supports `title` in `glimpseui@0.8.1`

Add a test or manual verification step that confirms the native window title is actually set. If `prompt` does not support `title`, switch to `open()` + `show({ title })` + manual result collection:

```typescript
const win = open(html, { width: 1200, height: 900 });
win.show({ title }); // GlimpseWindow.show accepts { title }
// ... attach message/closed listeners and return a Promise
```

---

## 5. Code Paths and Line Numbers

| File | Line | Purpose |
|------|------|---------|
| `tool/ask-user.ts` | 23 | `summarizeTitle()` — stopword-based title extraction |
| `tool/ask-user.ts` | 181-188 | Title construction and `windowOptions` object |
| `tool/ask-user.ts` | 196 | `prompt(html, { ...windowOptions, timeout: 120000 })` call |
| `types/glimpseui.d.ts` | 5 | `GlimpseWindowOptions` interface with `title?: string` |
| `types/glimpseui.d.ts` | 30 | `GlimpseWindow.show(options?: { title?: string })` |
| `types/glimpseui.d.ts` | 38 | `prompt(html, options?)` declaration |
| `webview/index.html` | 17 | `<title>Ask User</title>` |
| `webview/src/main.tsx` | 7-9 | Payload extraction from `window.__ASK_USER_PAYLOAD__` |
| `webview/src/App.tsx` | 126-140 | Layout: left panel (`ContextPanel`) + right panel (`renderComponent`) |
| `webview/src/App.tsx` | 156 | `ContextPanel` receives `question={payload.question}` |
| `webview/src/components/ContextPanel.tsx` | 192-212 | Question rendering with `renderMarkdownInline` |
| `webview/src/components/SelectDialog.tsx` | 1-364 | No `payload.question` rendering in main area |
| `webview/src/components/Freeform.tsx` | 1-45 | No `payload.question` rendering in main area |
| `webview/src/components/Questionnaire.tsx` | 1-180 | No `payload.question` rendering in main area |
| `constants/stopwords.ts` | 1-200 | Stopword list — "working" is NOT included |

---

## 6. Conclusion

The most likely root cause of the "Working instead of my message" issue is the **interaction between two problems**:

1. **`summarizeTitle()`** produces a single-word, out-of-context title ("Working") for questions that are mostly stopwords (e.g., "What are you working on?").
2. The **`prompt()` function** in `glimpseui@0.8.1` may not be consuming the `title` option correctly, causing the native window to either show the summarized title (if it works) or a default/native title (if it doesn't).

Additionally, the **user's question is only rendered in the left panel** (`ContextPanel`). If that panel is collapsed, the only remaining visible reference to the question is the window title — which is either "Working" or some native default. This creates the perception that the dialog is "showing Working instead of my message".

The fix should address both the title generation algorithm and the visibility of the question inside the dialog itself.

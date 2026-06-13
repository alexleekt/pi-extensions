# Context — pi-ask-user-glimpse

> Glossary of terms used across this codebase.
>
> See also: [README.md](./README.md) for usage, [ROADMAP.md](./ROADMAP.md) for current status.

## Dialog Types

| Type | Description | Keyboard Submit |
|------|-------------|----------------|
| `single-select` | Searchable option list with radio buttons. Number badges (1,2,3) for quick reference. | Enter |
| `multi-select` | Checkbox-style selection with "Select all" / "Select none" quick links. | ⌘+Enter / Ctrl+Enter |
| `freeform` | Full-height textarea with live character counter. | ⌘+Enter / Ctrl+Enter |
| `questionnaire` | Cards in a vertical list. Each question can be single-select, multi-select, or freeform. | ⌘+Enter / Ctrl+Enter |

## UI Components

| Term | Definition |
|------|-----------|
| **Header bar** | Branded bar at top of every dialog. Logo + title on left, settings cog + help on right. |
| **Context panel** | Left-side panel in two-panel mode. Renders `context` as markdown (default) or HTML (when `contextFormat: "html"`). |
| **Split handle** | Draggable divider between context panel and options panel. Double-click to collapse. |
| **OptionCard** | Shared component for rendering options with `role="option"`, `aria-selected`, recommendation badges, number badges. |
| **QuestionCard** | Shared component for questionnaire questions with progress indicator, inline markdown titles. |
| **CancelConfirmModal** | Modal shown when user presses Escape or clicks Cancel with unsaved changes. |
| **SettingsButton** | Dropdown for theme mode (dark/light/system), palette, and dialog zoom controls. |

## Data & State

| Term | Definition |
|------|-----------|
| **Payload** | The `AskUserPayload` object injected into the webview HTML as `window.__ASK_USER_PAYLOAD__`. Contains question, options, flags, and session metadata. |
| **Theme mode** | One of `light`, `dark`, `system`. Controls the webview color scheme. Persisted in localStorage. |
| **Resolved theme** | The actual `light` or `dark` value computed from the theme mode. `system` resolves via `prefers-color-scheme`. |
| **Animation level** | One of `none`, `minimal`, `all`. Controls CSS transition intensity across the UI. |
| **Dialog zoom** | Persistent user display preference controlled from settings or Cmd/Ctrl `+`, `-`, `0`. Scales dialog content without resizing the native window or panel split. |
| **Content zoom** | CSS-driven text/content scale shared by markdown context, HTML context, options, forms, and footer. Range is 50%–250% in 10% steps. |
| **Session name** | User-defined display name of the Pi session, sourced from `sessionManager.getSessionName()`. Used in the native window title. |
| **Stopword** | Common English word (e.g., "the", "is", "which") filtered out when generating a short title from the question text for the native window title bar. |

## Features & Behaviors

| Term | Definition |
|------|-----------|
| **Auto-split** | When a question exceeds 120 characters with no separate `context`, the first sentence becomes the title and the remainder flows to the context panel. |
| **Select-all option** | A multi-select option whose title matches patterns like "All of the above" or "Select all". Renders as a radio-style toggle that selects all regular options at once. |
| **HTML context** | When `contextFormat: "html"`, the `context` field renders inside a sandboxed iframe (`sandbox="allow-scripts"`) instead of markdown. Inherits the wrapper's CSS variables and content zoom for automatic light/dark/readability consistency. |
| **Readable question context** | Guidance pattern for agent-authored context: use markdown by default; add Mermaid or HTML only when structure, diagrams, metrics, or visual comparison make the decision easier to parse. |
| **Recommendation badge** | A "Recommended" badge shown next to options marked with `recommended: true`. |
| **Kitchen sink** | Developer-only `/ask-debug` scenario that opens a comprehensive questionnaire demonstrating every major feature in one dialog. |
| **Per-option comments** | A comment textarea attached to individual options (not the global AdditionalComments that was removed in v0.5.2). |
| **Ask Last** | `/ask` command flow that turns the last assistant request into a clean dialog, using an optional cleanup adapter and falling back to freeform when needed. |

## Security & Architecture

| Term | Definition |
|------|-----------|
| **Self-contained bundle** | `dist/index.html` must have zero external network requests. All JS, CSS, and assets inlined. |
| **Payload injection contract** | The `/*ASK_USER_PAYLOAD*/` placeholder replacement MUST escape `<`, `>`, and `&` as `\u003c`, `\u003e`, `\u0026` to prevent HTML injection. |
| **Fast-escape** | If `glimpseui.prompt()` throws and no UI is available, return an explicit error telling the agent to ask in free-form text. Never crash Pi. |
| **Glimpse null origin** | Glimpse loads the webview via `loadHTMLString(baseURL: nil)`, giving the page `null` origin. `localStorage` access throws `SecurityError`. Theme changes are propagated via `postMessage` instead. |
| **DOMPurify strict mode** | ContextPanel sanitization uses strict `ALLOWED_TAGS` and `ALLOWED_ATTR` lists. Blocks `script`, `img`, `iframe`, `object`, `embed`, `form`, `svg`, and strips `javascript:` / `data:` URLs. |
| **CSP meta tag** | Content-Security-Policy header in the HTML document to prevent inline script execution. |
| **Console artifact** | A `[pi-ask-user-glimpse]` tag rendered in the Pi UI when `console.log` or `console.warn` is called in a hook (`before_agent_start`). The Pi system captures console output and appends it to messages as a visual widget. |
| **Silent hook** | A hook that returns `undefined` without logging, avoiding console artifacts in the UI. |
| **hasSent guard** | Synchronous ref in `useBaseDialog` that prevents double-submit / double-cancel against the fire-and-forget Glimpse native bridge. |

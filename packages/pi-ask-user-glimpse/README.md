# @alexleekt/pi-ask-user-glimpse

[![npm](https://img.shields.io/npm/v/@alexleekt/pi-ask-user-glimpse)](https://www.npmjs.com/package/@alexleekt/pi-ask-user-glimpse)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Ask better questions. Get better answers.

Rich native WebView dialogs powered by [glimpseui](https://npmjs.com/package/glimpseui) and styled with shadcn/ui design tokens.

> **Stop reading terminal walls of text.** This extension turns every `ask_user` call into a beautiful, searchable, keyboard-navigable dialog — complete with markdown context panels, inline descriptions, and dark mode. Your agent asks better questions. You answer faster.

### Use Case: Scoping a New Project

Instead of the agent dumping a wall of questions into the terminal, it opens a native dialog:

```
┌──────────────────────────────────────────────┐
│  Which database should we use?                 │
│  ─────────────────────────────────────────   │
│  Context: We need something reliable for       │
│  production.                                  │
│                                              │
│  ○ PostgreSQL  · Relational, proven            │
│  ○ SQLite     · Zero-config, embedded          │
│  ○ Custom...                                 │
│                                              │
│                     [Cancel]  [Submit]        │
└──────────────────────────────────────────────┘
```

The agent gets a clean selection back. You get a decision made in seconds, not minutes of scrolling.

## Features

- **Single-select** — searchable option list with inline descriptions, numbered option badges (① ② ③), inline markdown rendering, and search highlight
- **Multi-select** — checkbox-style selection with quick-select all/none links, numbered badges, and inline markdown
- **Freeform** — textarea input with live character counter and platform-aware keyboard hints. Empty submissions are allowed (useful when the agent asks an open question but you have nothing to add)
- **Questionnaire** — cards in a vertical list for structured questions, with required-field badges, per-question character counters, numbered option badges, and inline markdown in option text
- **Theme toggle** — dark / light / system mode switcher in the dialog header
- **Animation levels** — none / minimal / all, controlling transition intensity across the UI
- **Keyboard shortcuts** — every dialog type shows a keyboard hint bar in the footer with relevant shortcuts (Esc, ↑↓, 1–9, Enter, ⌘/Ctrl+Enter, etc.)
- **Content zoom** — press ⌘/Ctrl+Plus/Minus/Zero to zoom content in/out/reset; zoom controls are also available in the palette dropdown
- **Prominent question header** — full non-truncated question text in the header bar, with palette icon for theme, zoom, and color settings
- **Native WebView** — renders in a real window (macOS WKWebView / Linux GTK4 / Windows WebView2)
- **Graceful degradation** — returns clear error when no UI is available, prompting the agent to ask in free-form text

## Install

```bash
pi install npm:@alexleekt/pi-ask-user-glimpse
```

Requires a Pi coding agent harness with extension support (e.g. `@earendil-works/pi-coding-agent`).

## Usage

Once installed, the extension automatically replaces the built-in `ask_user` tool. The LLM calls it the same way as before — you don't need to do anything different.

### Single Select

Ask the user to pick exactly one option:

```json
{
  "question": "Which database should we use?",
  "context": "We need something reliable for a production workload.",
  "options": [
    { "title": "PostgreSQL", "description": "Relational, proven, great ecosystem" },
    { "title": "SQLite", "description": "Zero-config, embedded, serverless" }
  ],
  "allowMultiple": false,
  "allowFreeform": true,
  "allowComment": true
}
```

The dialog shows the full question in the header bar, and a two-panel layout when `context` is provided. The left panel renders context as markdown (with Mermaid diagram support) while the right panel shows the searchable option list. The panels are resizable via a drag handle on the boundary — double-click the handle to collapse the context panel. Option descriptions appear inline below each title, and matching text is highlighted when searching. The "Custom" button lets the user submit a freeform answer. Use ⌘+Enter (macOS) or Ctrl+Enter to submit.

### Multi Select

Ask the user to pick multiple options:

```json
{
  "question": "Which features should we implement first?",
  "context": "MVP is due in 2 weeks. Pick the most impactful items.",
  "options": [
    { "title": "OAuth login", "description": "Google + GitHub sign-in" },
    { "title": "Real-time sync", "description": "WebSocket live updates" },
    { "title": "Email notifications", "description": "Digest + instant alerts" }
  ],
  "allowMultiple": true,
  "allowFreeform": true,
  "allowComment": true
}
```

Each option has a checkbox. "Select all" and "Select none" links appear above the list (when not searching). A "Clear all" link resets selections. Submit is disabled until at least one item is selected. Use ⌘+Enter (macOS) or Ctrl+Enter to submit.

### HTML Context (Visualizations)

When text and Mermaid diagrams aren't enough, render rich HTML in the context panel:

```json
{
  "question": "Which layout performs better?",
  "context": "<div style='display:flex;gap:1rem;justify-content:center'>...</div>",
  "contextFormat": "html",
  "options": [
    { "title": "Layout A", "description": "Dense grid with sidebar" },
    { "title": "Layout B", "description": "Spacious single column" }
  ]
}
```

The `context` HTML renders inside a **sandboxed iframe** (`sandbox="allow-scripts"`) in the left panel. It inherits the wrapper's CSS variables (`--background`, `--foreground`, `--primary`, etc.) for automatic light/dark theme consistency. The iframe auto-updates its theme class when the user toggles settings. This is ideal for throwaway bar charts, tables, decision trees, or any visualization that helps the user decide.

### Readable Question Context

Use the context panel to reduce decision friction, not to decorate the dialog. Prefer **markdown by default** because it is easy to skim, sanitize, and maintain. Add structure when it helps the user parse the trade-off quickly:

- Use headings, bullets, and tables for most decision summaries.
- Use Mermaid code blocks for flows, state machines, and dependency diagrams.
- Use `contextFormat: "html"` when visual comparison, metrics, color-coded grouping, pros/cons, timelines, or charts make the choice easier to understand.
- Keep the question itself short; put background detail in `context`.

HTML context inherits the active theme and the user's dialog zoom setting, so custom snippets should use CSS variables such as `hsl(var(--background))`, `hsl(var(--foreground))`, and `hsl(var(--primary))` instead of fixed light/dark colors.

**Security:** The iframe is isolated from the wrapper app. It cannot access `localStorage`, cookies, or the parent DOM. Only inline scripts are permitted (for animations/interactivity). The agent should not include `<script src="...">` tags that load external resources — inline JS and CSS only.

**Glimpse behavior:** The HTML context panel runs inside Glimpse's native WebView host (WKWebView on macOS, WebView2 on Windows). The iframe receives an opaque ("null") origin because Glimpse loads the page via `loadHTMLString` without a base URL. This means `window.location.origin` is `null`, and `localStorage` access throws a `SecurityError`. Theme changes are propagated via `postMessage` instead of DOM sharing.

### Freeform

Ask an open-ended question with no predefined options:

```json
{
  "question": "Describe the ideal user onboarding flow.",
  "context": "We're redesigning first-time experience. Be specific about steps, copy, and timing.",
  "allowFreeform": true
}
```

Shows a full-height textarea with a live character counter and platform-aware keyboard hints (⌘+Enter on macOS, Ctrl+Enter elsewhere). Submit is always enabled — you can send an empty answer if you have nothing to add.

### Questionnaire

Ask multiple structured questions in one dialog:

```json
{
  "question": "Project scoping questionnaire",
  "context": "Answer each question to help us scope accurately.",
  "questions": [
    {
      "title": "Database",
      "description": "Which database should we use?",
      "options": [
        { "title": "PostgreSQL", "description": "Relational, proven" },
        { "title": "SQLite", "description": "Zero-config" }
      ],
      "allowMultiple": false
    },
    {
      "title": "Cache layer",
      "description": "Select caching strategies",
      "options": [
        { "title": "Redis", "description": "In-memory key-value" },
        { "title": "Memcached", "description": "Simple caching" }
      ],
      "allowMultiple": true
    },
    {
      "title": "Notes",
      "description": "Any additional thoughts?"
    }
  ],
  "allowComment": true
}
```

Each question is shown as a card with a progress bar at the top. Questions with `options` render as single-select (radio) or multi-select (checkbox) depending on `allowMultiple`. Questions without `options` render as a textarea with a character counter. The dialog auto-scrolls to the first unanswered question on open. When `allowSkip: false`, unanswered questions show a red "Required" badge. The comment button shows "Edit comment" when text exists. Submit is disabled until all questions have a non-empty answer, unless `allowSkip: true` is set. Use ⌘+Enter (macOS) or Ctrl+Enter to submit.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `question` | `string` | *(required)* | The question to ask |
| `context` | `string` | — | Additional context shown in a left-side panel |
| `contextFormat` | `"markdown" &#124; "html"` | `"markdown"` | Format of the `context` field. `markdown` renders formatted text with Mermaid diagram support. `html` renders in a sandboxed iframe — useful for throwaway charts, tables, or interactive visualizations. The iframe inherits the wrapper's CSS variables for theme consistency. |
| `options` | `Array<string &#124; {title, description?, recommended?}>` | — | Options for flat single/multi-select mode. Set `recommended: true` to show a "Recommended" badge. |
| `questions` | `Array<{title, description?, options?, allowMultiple?}>` | — | Questions for questionnaire mode. When present, `options` is ignored. Each question can have its own `options` (same shape as top-level `options`) and `allowMultiple`. Questions without `options` render as freeform textareas. |
| `allowMultiple` | `boolean` | `false` | Allow selecting multiple options |
| `allowFreeform` | `boolean` | `true` | Show a freeform "Custom" option |
| `allowComment` | `boolean` | `false` | Collect an optional comment after selection |
| `allowSkip` | `boolean` | `false` | Allow submitting a questionnaire without answering all questions (questionnaire mode only) |
| `followCursor` | `boolean` | `false` | Make the 1200×900 dialog follow the terminal cursor |
| `displayMode` | `"overlay" &#124; "inline"` | — | Legacy option; ignored (always centered dialog) |

## Development

```bash
git clone https://github.com/alexleekt/pi-extensions.git
cd pi-extensions/packages/pi-ask-user-glimpse
npm install
```

### Build the webview bundle

```bash
npm run build        # builds CSS + Vite webview → dist/index.html
```

### Dev server for webview

```bash
npm run dev:webview  # Vite dev server on http://localhost:5173
```

### Validate

```bash
npm run validate     # checks dist/index.html exists and contains ASK_USER_PAYLOAD
npm run validate:gui # reminder for manual Pi WebView validation
npm run check        # full release gate: typecheck, unit tests, build, validate, e2e, pack dry-run
npm run check:pack   # dry-run npm pack only
```

## Slash Command: `/ask`

Use `/ask` when the assistant asked for input in plain text and you want to answer in a dialog:

```
/ask
```

### How it works

1. Finds the last assistant message in the session
2. Asks the Ask Last cleanup adapter to turn that request into a clean `ask_user` payload
3. Opens the best matching dialog: freeform, single-select, multi-select, or questionnaire
4. Falls back to a simple freeform dialog when cleanup is unavailable or invalid
5. Sends your answer back into the conversation as a user message

The extension does **not** change the agent's asking policy. It only renders dialogs. If you want the agent to ask less often, configure that in your agent instructions or skills.

### Optional cleanup command

By default, `/ask` uses the deterministic fallback. To experiment with LLM cleanup, set `PI_ASK_USER_CLEANUP_COMMAND` to a command that reads a JSON request from stdin and writes an `ask_user` payload as JSON to stdout. Invalid output is ignored and `/ask` falls back safely.

## Developer Command: `/ask-debug`

`/ask-debug` is hidden by default. Enable it for local QA with:

```bash
PI_ASK_USER_DEBUG=1 pi
```

Then open a debug prompt that lets you manually test each dialog type:

```
/ask-debug
/ask-debug kitchen-sink
```

The command supports argument completions. Type `/ask-debug kit<Tab>` to complete `kitchen-sink`. Try `/ask-debug readable-context` for a markdown + Mermaid decision prompt or `/ask-debug html-decision` for a focused HTML visualization prompt.

## Editor Autocomplete

The extension layers completions on top of Pi's built-in slash / path provider via `ctx.ui.addAutocompleteProvider()` (requires `pi-coding-agent ≥ 0.79.1`).

### `#<header>` — recall a recent ask_user call

Type `#` at a token boundary to open a fuzzy-completed dropdown of headers from the most recent `ask_user` calls. Each entry is the question's `title` (questionnaire sub-questions get one entry each), the value inserted is the full question text.

Examples:
- `#dat<Tab>` → `Which database should we use?` (from a recent single-select)
- `#arch<Tab>` → `Preferred architecture style?` (from a recent questionnaire)
- `#<Tab>` → newest-first list of all recent question headers

The store is **session-scoped**: cleared on `session_start`, capped at 20 entries, and reseeded from every `ask_user` tool call. There is no disk persistence.

### `/ask-debug <scenario>` — debug scenario completion

See [Slash Command: `/ask-debug`](#slash-command-ask-debug) above.

## Window Behavior

- **Title bar** — reads "Pi · {sessionName} · {question}" (session name is included when set)
- **Centered dialog** — normal stacking, not floating
- **Size** — 1200×900 by default
- **Context panel** — 50/50 split by default; drag the handle to resize, double-click to collapse
- **Scrollbars** — hidden by default, appear on hover (macOS-style overlay)
- **Cursor follow** — off by default; enable with `followCursor: true`
- **Dark mode** — togglable via the palette dropdown: dark, light, or system (follows OS preference)
- **Theme persistence** — theme and animation choices survive across dialogs and session restarts

## Architecture

```
index.ts              → Pi extension entrypoint (tool + command registration)
constants/            → STOPWORDS and other text helpers
tool/ask-last.ts      → builds /ask Ask Last payloads with cleanup adapter + fallback
tool/ask-user.ts      → constructs payload, injects into HTML, calls glimpseui.prompt()
tool/response-formatter.ts → normalizes WebView response for Pi
(no terminal fallback — fast-escape with error when UI unavailable)
webview/              → Vite + React + Tailwind app
  src/components/     → SelectDialog (single + multi), Freeform, Questionnaire, QuestionCard, OptionCard, ContextPanel, ErrorBoundary, HeaderBar, DialogFooter, CancelConfirmModal, GlobalKeyboardHint, SettingsButton, ThemeSelector, RichText, MarkdownPreview
  src/util/           → settings.tsx (theme/animation context), glimpse.ts (host bridge), platform.ts (modKey), html.ts (escapeHtml + highlightMatch), markdown.ts (renderMarkdown + DOMPurify), pi-charts.ts (window.pi micro library)
  dist/index.html     → single-file bundle (inlined JS + CSS)
```

## Troubleshooting

### "Could not find webview bundle"

Run `npm run build` to generate `dist/index.html`. The extension cannot work without the webview bundle.

### WebView does not open

If the glimpseui native host is unavailable, the extension returns an error to the agent, which will ask the question in free-form text instead. This is normal on headless systems or if the native binary is missing. Check `npm run validate` to see if the binary is detected.

### Dialog shows "Missing or invalid ask_user payload"

This means the HTML payload injection failed. Ensure `dist/index.html` contains the `/*ASK_USER_PAYLOAD*/` placeholder. Run `npm run build` to regenerate.

## Documentation

| Document | What it covers |
|----------|---------------|
| [CHANGELOG.md](./CHANGELOG.md) | What's shipped in each release |
| [ROADMAP.md](./ROADMAP.md) | Current status, known issues, and upcoming work |
| [CONTEXT.md](./CONTEXT.md) | Glossary of terms used across the codebase |
| [AGENT.md](./AGENT.md) | Behavioral rules for AI agents working on this codebase |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Developer setup, build instructions, and testing |

### Interactive HTML Documentation

Rich HTML versions of the documentation are available in the `docs/` directory:

| Document | Features |
|----------|----------|
| [docs/index.html](docs/index.html) | Landing page with dialog previews, feature tags, and quick links |
| [docs/readme.html](docs/readme.html) | Full README rendered with rich styling, table of contents, and code highlighting |
| [docs/changelog.html](docs/changelog.html) | Interactive timeline with category filters, expand/collapse, and change counts |
| [docs/roadmap.html](docs/roadmap.html) | Interactive filters, progress bars, milestone timeline, and severity indicators |
| [docs/glossary.html](docs/glossary.html) | Searchable terms with category filters, copy-to-clipboard, and cross-links |

These HTML files load dynamically from their markdown source files (e.g., `docs/roadmap.html` fetches `ROADMAP.md` at runtime). Edit the markdown files to update both the GitHub view and the interactive HTML view.

## License

MIT

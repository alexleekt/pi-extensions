# @alexleekt/pi-ask-user-glimpse

[![npm version](https://img.shields.io/npm/v/@alexleekt/pi-ask-user-glimpse.svg)](https://www.npmjs.com/package/@alexleekt/pi-ask-user-glimpse)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Pi extension that replaces `ask_user` with rich native WebView dialogs powered by [glimpseui](https://npmjs.com/package/glimpseui) and styled with shadcn/ui design tokens.

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

- **Single-select** — searchable option list with inline descriptions and search highlight
- **Multi-select** — checkbox-style selection with quick-select all/none links
- **Freeform** — textarea input with live character counter and platform-aware keyboard shortcuts
- **Questionnaire** — cards in a vertical list for structured questions, with required-field badges and per-question character counters
- **Theme toggle** — dark / light / system mode switcher in the dialog header
- **Animation levels** — none / minimal / all, controlling transition intensity across the UI
- **Keyboard shortcuts legend** — press `?` in the header bar to see all available shortcuts
- **Prominent question header** — full non-truncated question text in the header bar, with settings cog and keyboard-shortcuts help
- **Native WebView** — renders in a real window (macOS WKWebView / Linux GTK4 / Windows WebView2)
- **Terminal fallback** — gracefully degrades to TUI prompts when glimpseui is unavailable

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

### Freeform

Ask an open-ended question with no predefined options:

```json
{
  "question": "Describe the ideal user onboarding flow.",
  "context": "We're redesigning first-time experience. Be specific about steps, copy, and timing.",
  "allowFreeform": true
}
```

Shows a full-height textarea with a live character counter and platform-aware keyboard hints (⌘+Enter on macOS, Ctrl+Enter elsewhere). Submit is disabled until text is entered.

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
| `context` | `string` | — | Additional context shown in a left-side markdown panel |
| `options` | `Array<string &#124; {title, description?}>` | — | Options for flat single/multi-select mode |
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
npm run validate     # checks dist exists, placeholder present, binary found
npm run validate:gui # same + opens actual WebView for visual check
npm run check        # dry-run npm pack
```

## Always-On: When `ask_user` Is Used Automatically

Some skills instruct the agent to "ask questions one at a time" but never tell it to **use a tool** — so the agent writes plain text, bypassing the rich WebView dialog.

This extension always injects a system-prompt mandate that tells the LLM to use `ask_user` for every question. You can toggle this off per-session if needed.

### Manual toggle: `/ask-style`

Override the default for the current session:

```
/ask-style
```

Cycles through two states:

| State | Behavior |
|-------|----------|
| **Always Dialog** *(default)* | Always use `ask_user` for every question |
| **Plain Text** | Disable everything — let the agent write questions as plain text |
| **YOLO** | Never ask — the agent proceeds with its best recommendation |

The setting is persisted in the session and survives restarts.

### YOLO mode

When YOLO is active, the extension injects a mandate telling the agent **not** to ask for input or confirmation. Instead, the agent goes with its best recommendation and keeps moving. It will only use `ask_user` if the action would cause irreversible harm, data loss, or security compromise.

Use this when you trust the agent's judgment and want maximum speed:

```
/ask-style
→ ask_user style: YOLO — go with your recommendation
```

### Token cost

The injected mandate is ~100 tokens. It is appended on every turn when `ask_user` is available in the tool set.

## Slash Command: `/ask`

When the assistant writes a question as free-form text (bypassing `ask_user`), use this command to retroactively open the rich dialog:

```
/ask
```

### How it works

1. Finds the last assistant message in the session
2. Extracts all sentences ending with `?`
3. If one question → opens a **freeform** dialog with the full message as context
4. If multiple questions → opens a **questionnaire** with each question as an item
5. Sends your answer back into the conversation as a user message

This is useful when:
- A skill or the agent itself wrote a question as plain text
- You want to answer via the rich WebView instead of typing inline
- The agent asked multiple things and you want to answer them all at once

## Slash Command: `/ask-debug`

Open a debug prompt that lets you manually test each dialog type:

```
/ask-debug
```

Options: `single-select`, `multi-select`, `freeform`, `questionnaire`. The result is shown as a Pi notification.

## Window Behavior

- **Title bar** — reads "Pi · {sessionName} · {question}" (session name is included when set)
- **Centered dialog** — normal stacking, not floating
- **Size** — 1200×900 by default
- **Context panel** — 50/50 split by default; drag the handle to resize, double-click to collapse
- **Scrollbars** — hidden by default, appear on hover (macOS-style overlay)
- **Cursor follow** — off by default; enable with `followCursor: true`
- **Dark mode** — togglable via the settings cog: dark, light, or system (follows OS preference)
- **Theme persistence** — theme and animation choices survive across dialogs and session restarts

## Architecture

```
index.ts              → Pi extension entrypoint (tool + command registration)
constants/            → STOPWORDS, PROTECTED_ABBREVIATIONS
tool/ask-user.ts      → constructs payload, injects into HTML, calls glimpseui.prompt()
tool/response-formatter.ts → normalizes WebView response for Pi
fallback/terminal-prompt.ts → readline fallback when WebView unavailable
webview/              → Vite + React + Tailwind app
  src/components/     → SingleSelect, MultiSelect, Questionnaire, Freeform, ContextPanel, ErrorBoundary, HeaderBar, ShortcutsModal, AdditionalComments
  src/util/           → settings.tsx (theme/animation context), glimpse.ts (host bridge), platform.ts (modKey), html.ts (escapeHtml + highlightMatch)
  dist/index.html     → single-file bundle (inlined JS + CSS)
```

## Troubleshooting

### "Could not find webview bundle"

Run `npm run build` to generate `dist/index.html`. The extension cannot work without the webview bundle.

### WebView does not open (terminal fallback instead)

The extension falls back to TUI prompts when the glimpseui native host is unavailable. This is normal on headless systems or if the native binary is missing. Check `npm run validate` to see if the binary is detected.

### Dialog shows "Missing or invalid ask_user payload"

This means the HTML payload injection failed. Ensure `dist/index.html` contains the `/*ASK_USER_PAYLOAD*/` placeholder. Run `npm run build` to regenerate.

## License

MIT

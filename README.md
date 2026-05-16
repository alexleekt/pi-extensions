# @alexleekt/pi-ask-user-glimpse

A Pi extension that replaces `ask_user` with rich native WebView dialogs powered by [glimpseui](https://npmjs.com/package/glimpseui) and styled with shadcn/ui design tokens.

## Features

- **Single-select** — searchable option list with inline descriptions
- **Multi-select** — checkbox-style selection with submit/cancel
- **Freeform** — textarea input for open-ended responses
- **Questionnaire** — cards in a vertical list for structured questions, each with its own options
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

The dialog shows a full-width question header and a two-panel layout. When `context` is provided, the left panel renders it as markdown for reference while the right panel shows the searchable option list. Option descriptions appear inline below each title. The "Custom" button under the search box lets the user submit a freeform answer.

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

Each option has a checkbox. A "Clear all" link resets selections. Submit is disabled until at least one item is selected.

### Freeform

Ask an open-ended question with no predefined options:

```json
{
  "question": "Describe the ideal user onboarding flow.",
  "context": "We're redesigning first-time experience. Be specific about steps, copy, and timing.",
  "allowFreeform": true
}
```

Shows a full-height textarea with platform-aware keyboard hints (⌘+Enter on macOS, Ctrl+Enter elsewhere). Submit is disabled until text is entered.

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

Each question is shown as a card with a progress bar at the top. Questions with `options` render as single-select (radio) or multi-select (checkbox) depending on `allowMultiple`. Questions without `options` render as a textarea. The dialog auto-scrolls to the first unanswered question on open. The comment button shows "Edit comment" when text exists. Submit is disabled until all questions have a non-empty answer.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `question` | `string` | *(required)* | The question to ask |
| `context` | `string` | — | Additional context shown in a left-side markdown panel |
| `options` | `Array<string \| {title, description?}>` | — | Options for flat single/multi-select mode |
| `questions` | `Array<{title, description?, options?, allowMultiple?}>` | — | Questions for questionnaire mode. When present, `options` is ignored. |
| `allowMultiple` | `boolean` | `false` | Allow selecting multiple options |
| `allowFreeform` | `boolean` | `true` | Show a freeform "Custom" option |
| `allowComment` | `boolean` | `false` | Collect an optional comment after selection |
| `followCursor` | `boolean` | `false` | Make the 1200×900 dialog follow the terminal cursor |
| `displayMode` | `"overlay" \| "inline"` | — | Legacy option; ignored (always centered dialog) |

## Development

```bash
git clone https://github.com/alexleekt/pi-ask-user-glimpse.git
cd pi-ask-user-glimpse
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

## Auto-Force: When to Use `ask_user` Automatically

By default, Pi lets the LLM decide whether to write a question as free-form text or call the `ask_user` tool. Some skills (like `grill-with-docs`) instruct the agent to "ask questions one at a time" but never tell it to **use a tool** — so the agent defaults to writing plain text, bypassing the rich WebView dialog.

This extension auto-detects question-oriented sessions and injects a system-prompt mandate that forces the LLM to use `ask_user` for every question.

### Auto-detection

The extension checks each turn before the LLM starts:

1. **Known question skills** — `grill-with-docs`, `questionnaire`, `interview`, `grill`
2. **Language patterns** in the system prompt — phrases like "ask the questions one at a time", "interview me", "grilling session", "wait for feedback"
3. **Manual toggle** — `/ask-force` to force it on or off for the current session

If any condition matches, it appends a mandate: "You MUST use `ask_user` for every question. Do NOT write free-form text."

### Manual toggle: `/ask-force`

Override auto-detection for the current session:

```
/ask-force
```

Toggles forced mode ON or OFF. The setting is persisted in the session and survives restarts.

- **ON** — Every question the agent wants to ask goes through `ask_user` (WebView or terminal fallback).
- **OFF** — The agent uses its own judgment (default Pi behavior).

### Token cost

The injected mandate is ~100 tokens. It is only appended when detection triggers, so normal conversations pay nothing extra.

## Slash Command: `/ask-debug`

Open a debug prompt that lets you manually test each dialog type:

```
/ask-debug
```

Options: `single-select`, `multi-select`, `freeform`, `questionnaire`. The result is shown as a Pi notification.

## Window Behavior

- **Title bar** — shows a condensed version of the question text (up to 3 content words)
- **Centered dialog** — normal stacking, not floating
- **Size** — 1200×900 by default
- **Cursor follow** — off by default; enable with `followCursor: true`
- **Dark mode** — automatically follows the system `prefers-color-scheme` setting

## Architecture

```
index.ts              → Pi extension entrypoint (tool + command registration)
tool/ask-user.ts      → constructs payload, injects into HTML, calls glimpseui.prompt()
tool/response-formatter.ts → normalizes WebView response for Pi
webview/src/components/     → SingleSelect, MultiSelect, Questionnaire, Freeform, ContextPanel, ErrorBoundary
fallback/terminal-prompt.ts → readline fallback when WebView unavailable
webview/              → Vite + React + Tailwind app
  src/components/     → SingleSelect, MultiSelect, Questionnaire, Freeform
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

# Changelog

All notable changes to `@alexleekt/pi-ask-user-glimpse` are documented in this file.

## [0.2.0] — 2026-05-16

### Added
- **Two-panel layout with markdown context** — When `context` is provided, the dialog splits 40/60: left panel renders context as markdown (via `marked`), right panel shows the question and options. The question title spans the full width as a global header.
- **Progress bar and answered counter** in Questionnaire dialogs — thin `h-1` bar + "N / M answered" text.
- **Auto-scroll to first unanswered question** on Questionnaire open.
- **Auto-focus first option** in SingleSelect and MultiSelect when search box is hidden (≤6 options).
- **Auto-focus search input** when visible.
- **Submit loading state** — button text changes to "Submitting…" and is disabled across all dialog types, preventing double-clicks.
- **Platform-aware keyboard hints** — shows `⌘+Enter` on macOS, `Ctrl+Enter` elsewhere.
- **Inline SVG icons** for radio buttons and checkboxes (crisp at any scale, replaces text-based `✓` and CSS circles).
- **ARIA roles** — `role="listbox"`, `role="option"`, `aria-selected`, `aria-multiselectable`, `aria-checked`, `aria-expanded` across all option lists.
- **ErrorBoundary** around each panel in `App.tsx` — catches runtime React errors gracefully instead of crashing the webview.
- **Empty search state** — "No matching options" message with guidance when filter returns zero results.
- **"Clear all" link** in MultiSelect to reset all selections in one click.
- **Comment existence indicator** — button label changes from "Add comment" to "Edit comment" when text exists.
- **HTML sanitization** in `ContextPanel` — strips `<script>` tags and `on*` event handlers before `dangerouslySetInnerHTML`.
- **Questionnaire freeform auto-focus** — textarea gets focus on mount for the first unanswered freeform question.

### Changed
- **Window size** — increased from `640×480` to `1200×900` to accommodate the two-panel layout and long option lists.
- **Option descriptions** — moved from a destructive sidebar preview pane to always-visible inline text with a left border indent.
- **"Other" button** — renamed to "Custom" and moved from bottom of scrollable list to directly under the search box.
- **Search box** — now conditional: hidden when `options.length <= 6` and `!allowFreeform`, reducing clutter for simple questions.
- **Cancel button** — changed from bordered secondary button to ghost style (no border, muted text) to reduce accidental clicks.
- **MultiSelect "N selected" badge** — moved from bottom bar to a primary-colored chip in the header area.
- **Comment toggle** — changed from invisible underlined text to an inline SVG icon button with hover background.
- **Keyboard hint placement** — moved from orphaned `text-xs` above buttons to inline with the action bar.
- **Questionnaire spacing** — tightened from `space-y-6` to `space-y-3`.
- **Questionnaire freeform input** — changed from `<input type="text">` to `<textarea rows={3}>`.
- **Description border color** — `border-border` → `border-muted-foreground/30` for visible contrast in both light and dark modes.
- **Custom button query truncation** — long queries are truncated to 30 chars with "…".
- **Response trimming** — `response-formatter.ts` now trims freeform text and questionnaire answers.

### Fixed
- **SingleSelect preview pane bug** — clicking to read a description no longer deselects the current choice.
- **Questionnaire `allAnswered` bug** — empty freeform strings no longer count as "answered".
- **SingleSelect keyboard Enter bypass** — `isSubmitting` guard now respected when selecting via keyboard.
- **Terminal fallback context** — `payload.context` was completely ignored in TUI fallback; now prepended to all prompts.
- **Terminal multi-select freeform** — picking "Other" no longer discards all prior selections.
- **Terminal questionnaire freeform** — open-ended questions now show context if provided.
- **`ctx.hasUI` guard** in `/ask-debug` — replaced crash-risk `ctx.ui.notify()` with `console.warn()`.
- **Dead code** — removed unused `util/safe-callback.ts` and cleaned up `tsconfig.json` / `package.json` `files` array.
- **README** — synced all stale references (preview pane → inline descriptions, Other → Custom, 640×480 → 1200×900).

## [0.1.1] — 2026-05-16

### Added
- Keyboard shortcuts in all webview dialogs:
  - `Escape` — Close open comment textarea; if none open, cancel dialog
  - `Enter` — Select+submit focused option (SingleSelect), submit questionnaire (Questionnaire), toggle option (MultiSelect/Questionnaire with Space)
  - `ArrowUp`/`ArrowDown` — Navigate options with roving tabindex (SingleSelect, MultiSelect)
  - `Space` — Toggle multi-select options
  - `Ctrl+Enter` — Submit freeform/ questionnaire
  - `Tab` — Natural focus movement
- Visual focus ring (`ring-2 ring-ring`) on keyboard-focused options

### Changed
- Extracted shared types (`AskUserPayload`, `Question`, `QuestionOption`) from `tool/ask-user.ts` and `webview/src/App.tsx` into `shared/ask-user.ts`. Both server and webview now import from the single source of truth.
- **Questionnaire `kind` consistency:** WebView and terminal fallback now send `kind: "questionnaire"` with per-question `kind` in `questionnaireDetails` (either `"selection"` or `"freeform"`). Previously all questionnaire answers were incorrectly labeled as `"selection"`.

### Fixed
- **Critical:** `allAnswered` check in Questionnaire no longer rejects empty-string freeform answers with strict equality (`=== ""`). Now correctly allows empty strings as valid freeform responses while still requiring non-empty arrays for multi-select answers.
- **Payload injection:** Production code in `tool/ask-user.ts` now properly escapes `<`, `>`, and `&` as `\u003c`, `\u003e`, `\u0026` when serializing JSON into the HTML template, preventing HTML injection attacks. Test scripts updated to match.
- **`resolveWebviewHtml` error propagation:** File-not-found errors now include the full list of paths tried and a clear instruction (`Run 'npm run build' first`), instead of an unhelpful generic error.
- **`displayMode` warning:** Runtime warning added when `displayMode` parameter is passed, since Glimpse always opens a centered dialog regardless of the parameter value. Previously the parameter was silently ignored.

## [0.1.0] — 2026-05-16

### Added
- Single-select dialog with searchable options and split-pane description preview
- Multi-select dialog with checkbox-style selection
- Freeform dialog with full-height textarea
- Questionnaire dialog with per-question options (single-select, multi-select, or freeform)
- Native WebView rendering via glimpseui (macOS WKWebView / Linux GTK4 / Windows WebView2)
- Terminal fallback when glimpseui native host is unavailable
- `/ask-debug` slash command for manual dialog testing
- Self-contained webview bundle (single inlined HTML file, zero external requests)
- Dark mode support via `prefers-color-scheme`

### Fixed
- **Critical:** Test scripts (`validate.ts`, `smoke-test.ts`, `visual-qa.ts`) now properly escape `>`, `&`, and `<` when injecting JSON into HTML, matching production escaping
- **Bug:** MultiSelect no longer allows empty submission when a search query is present but no option is selected
- **Dead code:** Removed unreachable `getQuestions` fallback in Questionnaire component
- **Config:** Removed stale `@earendil-works/pi-tui` peer dependency (never imported)
- **Config:** Added `prepack` script to ensure webview bundle is built before `npm publish`
- **Config:** Simplified `tsconfig.json` to use `noEmit: true` (Pi loads `.ts` directly)
- **Cleanup:** Removed ~24 duplicate stopwords from `STOPWORDS` set
- **Types:** Fixed `getInfo()` return type in hand-written `glimpseui.d.ts` (`void` → `unknown`)



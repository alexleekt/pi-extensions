# Changelog

All notable changes to `@alexleekt/pi-ask-user-glimpse` are documented in this file.

## [0.4.0] — 2026-05-20

### Added
- **Branded header bar** — A thin branded bar at the top of every dialog with a sparkle icon + "Ask User" label on the left, and a settings cog + keyboard-shortcuts help on the right.
- **Theme toggle (dark / light / system)** — Settings dropdown lets users switch between dark mode, light mode, or following the OS preference. Choice is persisted in the webview's localStorage.
- **Animation level toggle (none / minimal / all)** — Settings dropdown also controls animation intensity. "None" disables all transitions; "minimal" keeps only essential ones; "all" enables full polish.
- **Consistent Cmd+Enter submit** — All four dialog types (single-select, multi-select, questionnaire, freeform) now support Cmd+Enter (macOS) / Ctrl+Enter (other) to submit the answer. Footer hints updated accordingly.
- **Window titles with session name** — Titles now read "Pi · {sessionName} · {question}" when a session name is set, making it easier to identify which conversation a dialog belongs to.
- **Character counter** — Freeform textareas and questionnaire freeform fields show a live `0/2000` or `0/1000` counter. Turns red when approaching the limit.
- **Required field badge** — In questionnaire mode, when `allowSkip: false`, unanswered questions show a red "Required" badge and a subtle red border until answered.
- **Search highlight** — When filtering options via the search box, matching text in option titles and descriptions is highlighted with a yellow background.
- **Quick-select all/none** — Multi-select dialogs show "Select all" and "Select none" links above the option list (when not actively searching).
- **Keyboard shortcuts legend** — A `?` button in the header bar opens a modal showing all available keyboard shortcuts.

### Changed
- **CSS dark mode strategy** — Switched from `prefers-color-scheme` media query to Tailwind's `darkMode: 'class'` strategy, enabling explicit theme toggling independent of OS setting.
- **Theme metadata in results** — The webview sends back the active theme and animation level with every result, so the extension can persist preferences across sessions.

### Fixed
- **White screen on /ask-debug** — The Glimpse native webview (WKWebView) blocks `localStorage` access with `SecurityError: The operation is insecure.` because `loadHTMLString(baseURL: nil)` gives the page no origin. Removed all `localStorage` usage from the webview entirely. Theme and animation state now flows through the payload: the extension reads stored settings from Pi journal entries, passes them into the webview via `AskUserPayload`, and the webview sends back the user's choices via the result's `__theme`/`__animationLevel` fields. The extension then persists them back into journal entries.
- **Top-level ErrorBoundary** — Wrapped the entire React app in an `ErrorBoundary` so future render crashes show a readable error message instead of an empty white screen.

## [0.3.2] — 2026-05-20

### Fixed
- **Recover all fixes lost during cherry-pick** — When cherry-picking the mermaid commit onto main, the jj colocated working copy was silently reset, discarding every other fix. This release restores: empty submit, shared icons/components, additional comments, auto-split logic, questionnaire focus fix, and updated prompt guidelines.

## [0.3.1] — 2026-05-20

### Fixed
- **Mermaid rendering was missing from v0.3.0** — The mermaid ContextPanel changes were committed on an orphaned branch and never merged into main before the v0.3.0 publish. This release includes them properly.

## [0.3.0] — 2026-05-20

### Added
- **Always-present "Additional Comments"** — Every dialog type (SingleSelect, MultiSelect, Questionnaire) now shows a non-toggleable freeform textarea at the bottom. Users can submit just additional comments without answering the main question.
- **Empty submission allowed** — Submit button is always enabled. Users can submit without selecting options, answering questions, or typing freeform text.
- **"All of the above" radio toggle** — Multi-select options matching patterns like "All of the above", "Select all", "Everything" render as radio buttons. Clicking them selects all regular options at once. Selecting any individual option automatically deselects the "All" toggle.
- **Auto-split long questions** — When the `question` field exceeds 120 characters and no separate `context` is provided, the first sentence becomes the dialog title and the remainder flows to the left context panel.
- **Mermaid diagram rendering** — The context panel now renders ` ```mermaid ` code blocks as interactive SVG diagrams (flowcharts, sequence diagrams, etc.). The `mermaid` package is bundled into the webview.
- **Shared icon components** — Extracted `RadioIcon`, `CheckIcon`, `CommentIcon`, and `isSelectAllOption` from duplicated inline SVGs into `webview/src/components/icons.tsx`.
- **New `/ask-debug` test scenarios** — Added `mermaid` and `long-question` mock modes, plus "All of the above" options in multi-select and questionnaire mocks.

### Changed
- **Prompt guidelines** — Updated tool description and parameter docs to encourage agents to include Mermaid diagrams in the `context` field when visualizing architecture, flows, or relationships would aid understanding.
- **Max-height headers** — Added `max-h-24 overflow-y-auto` to all component headers and `max-h-32` to the global App header as a defensive cap against long titles.
- **Response formatter** — Added `additionalComments` field to both `selection` and `questionnaire` response kinds. Empty answers are now filtered from questionnaire submissions.

### Fixed
- **Questionnaire focus-steal bug** — The mount-only auto-focus `useEffect` was incorrectly including `answers` in its dependency array, causing it to re-run on every keystroke and steal focus from the current textarea to the next question.

## [0.2.1] — 2026-05-16

### Fixed
- **AGENTS.md stale references** — Removed references to deleted `util/detect-conflict.ts` and `util/safe-callback.ts` files.
- **`allowSkip` schema gap** — Added `allowSkip` parameter to the `defineTool` schema so the LLM can request partial questionnaire submission.
- **`visual-qa.ts` non-existent event** — Removed `"ready"` event listener which is not declared in `glimpseui.d.ts`.
- **Tailwind CSS build warning** — Fixed by running Vite from the `webview/` directory so Tailwind resolves content paths correctly.
- **`validate.ts` placeholder check** — Now checks for exact placeholder `/*ASK_USER_PAYLOAD*/` instead of substring match.
- **Missing `pi-ai` peer dependency** — Added `@earendil-works/pi-ai` to `peerDependencies` since `index.ts` imports `StringEnum` from it.
- **Repeated `window.glimpse.send` type assertion** — Extracted to `webview/src/util/glimpse.ts` helper with `sendToGlimpse()` and `sendCancelled()`.

### Added
- **CONTRIBUTING.md** — Developer setup, build instructions, and pre-submission checklist.
- **README badges** — npm version and MIT license shields.
- **`engines` field** — Requires Node.js >= 18.0.0.
- **`CHANGELOG.md` in npm files** — Now included in the published tarball.
- **`.jj/` in `.gitignore`** — Jujutsu working directory ignored.

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



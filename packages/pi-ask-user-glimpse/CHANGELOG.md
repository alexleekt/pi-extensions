# Changelog

All notable changes to `@alexleekt/pi-ask-user-glimpse` are documented in this file.

## [0.5.1] — 2026-05-27

### Changed

- Documentation refresh: add `pi-event-horizon-provider` context and ADR references to internal docs

## [0.5.0] — 2026-05-24

### Added
- **Kitchen-sink debug mode** — `/ask-debug` now includes a `kitchen-sink` option that opens a comprehensive questionnaire demonstrating every major feature in one dialog: HTML context panel, recommended badges, multi-select, single-select, freeform, comments, and skip. Replaces the previous 9-mode menu (which had 5 redundant single-select variations) with a clean 5-mode list.
- **HTML context iframe sizing fix** — Removed `loading="lazy"` from the sandboxed iframe. Glimpse's native WebView host (WKWebView on macOS / WebView2 on Windows) applies lazy-loading heuristics even to `srcDoc` iframes with no network request, causing the HTML content to never render in some versions. Changed the iframe container from `overflow-y-auto` to `overflow-hidden flex flex-col` so the iframe's `flex-1` sizing works reliably within the flex layout. The iframe now uses `flex-1 min-h-0` instead of `h-full` to avoid the 150px default-height fallback when percentage heights fail in nested flex contexts.
- **Recommendation badges** — Options can now include `recommended: true` to show a "Recommended" badge in the dialog. The badge renders next to the option title using the primary color token. Works in single-select, multi-select, and questionnaire modes. The LLM tool schema documents the field so agents can mark their top recommendation.
- **Option numbering** — Each option now displays a circular number badge (① ② ③…) between the checkbox/radio and the title text. Provides a quick visual reference for keyboard navigation and makes it easier to refer to options when discussing choices.
- **Markdown rendering in option text** — Option titles and descriptions are now rendered through inline markdown. Bold `**`, italic `*`, code `` ` ``, and links display correctly. During search, markdown rendering is temporarily disabled to avoid broken markup from injected `<mark>` highlight tags.
- ~~Auto-catch free-form questions~~ — **Removed.** The "Always Dialog" mode and its auto-catch behavior have been eliminated.
- **HTML context format** — New `contextFormat: "html"` option for the `ask_user` tool. When set, the `context` field renders inside a sandboxed iframe (`sandbox="allow-scripts"`) in the left panel instead of markdown. The iframe inherits the wrapper's CSS variables for automatic light/dark theme consistency. Theme changes are propagated via `postMessage`.
- **YOLO style** — New `/ask-style` state that tells the agent to proceed with its best recommendation without asking. Injects a mandate: "Do NOT ask the user for input or confirmation. Go with your best recommendation and proceed immediately. Only use `ask_user` if the action would cause irreversible harm, data loss, security compromise, or violate explicit hard constraints."

### Removed
- **"Always Dialog" mode** — Removed the `ASK_USER_MANDATE` system-prompt injection and the auto-catch behavior that converted free-form agent questions into dialogs. These features caused excessive dialog interruptions and were too aggressive for general use. The `/ask` command and manual `ask_user` tool calls still work normally.

### Changed
- **Plain Text is now the default** — The extension no longer injects any system-prompt mandate by default. The agent writes questions as free-form text unless the user manually triggers `/ask` or the agent calls `ask_user`. The `/ask-style` toggle now cycles through **Plain Text** → **YOLO** → **Plain Text**.
- **Two-state `/ask-style` cycle** — `Plain Text → YOLO → Plain Text`.
- **`deliverAs: "steer"` for all user message delivery** — Both auto-catch and `/ask` now use `steer` instead of `followUp` when sending answers back to the conversation. `steer` sends immediately and is processed as an active user intervention, avoiding the "Follow-up: queued messages" UI state where the answer was stuck waiting.
- **Removed terminal fallback** — Deleted `fallback/terminal-prompt.ts`. When the Glimpse native host is unavailable, the extension always returns an explicit error telling the agent to ask in free-form text. The previous TUI fallback (`ctx.ui.select()` / `ctx.ui.input()`) has been removed to simplify the codebase and provide consistent behavior.
- **Freeform empty submissions allowed** — Removed the guard that blocked empty freeform text submissions. This is consistent with questionnaire behavior where unanswered questions are allowed when `allowSkip: true`.

### Added
- **Agent preamble capture** — When the agent writes an introductory message before calling `ask_user`, that text is now automatically captured and prepended to the context panel. The extension finds the most recent assistant journal entry, extracts its text content, and appends it to the dialog's left panel (separated by a horizontal rule from any explicit `context` provided by the agent). This ensures the user sees the full reasoning that led to the question, not just the question itself.

### Fixed
- **Markdown in question header** — The `question` field is now rendered through `marked` so inline markdown (bold `**`, italic `*`, code `` ` ``, links) displays correctly instead of showing raw escape characters. The HTML is sanitized with the same defense-in-depth sanitizer used by the context panel. Extracted shared `sanitizeHtml()`, `renderMarkdown()`, and `renderMarkdownInline()` to `webview/src/util/markdown.ts`.
- **`sendUserMessage` error handling** — Wrapped `pi.sendUserMessage()` in `try/catch` with `await` in the `/ask` handler. Previously, the promise was fire-and-forget; when the framework threw "Agent is already processing" (or any other error), the rejection was unhandled and the dialog answer was silently lost. Errors are now logged to console with `[pi-ask-user-glimpse]` prefix and surfaced via UI notification.
- **`additionalComments` in questionnaire responses** — The `questionnaire` response kind was missing the `additionalComments` field that existed for `selection` and `freeform` kinds. Now all three kinds consistently include `additionalComments` when the user provides them.
- **Fast-escape when no UI available** — `askUserHandler` now returns an explicit error message ("No UI available for ask_user dialog...") instead of falling back to a terminal prompt when `!ctx.hasUI`. The `before_agent_start` mandate injection is also skipped in headless environments, preventing the agent from being forced to use a tool that cannot work.

## [0.4.1] — 2026-05-20

### Security
- **Comprehensive HTML sanitization** — `ContextPanel.sanitizeHtml()` now blocks `img`, `iframe`, `object`, `embed`, `form`, `input`, `style`, `link`, `svg`, `math`, `meta`, `base`, `noscript`, `template`, `portal`, `frame`, `frameset` tags, plus `javascript:` and `data:` URLs in `href`/`src`/`action` attributes.
- **XSS-safe search highlighting** — `highlightMatch()` in new `webview/src/util/html.ts` escapes both display text and query strings before wrapping matches in `<mark>`. Replaces raw `.replace()` in `SingleSelect` and `MultiSelect` that was vulnerable to search query injection.

### Changed
- **Prominent question header** — Removed sparkle icon and "Ask User" branding. The header now shows the full non-truncated question text in `text-base` font, wrapping naturally.
- **50/50 panel split** — Default context/options panel width changed from 40/60 to 50/50.
- **Invisible splitter track** — Removed grey divider bar. Only a centered grip handle is visible (`w-1` by default, `w-1.5` on drag). Handle sits exactly at the panel boundary.
- **Instant drag feedback** — Removed CSS transition from panel width so resize is immediate, not animated.
- **Double-click to collapse** — Double-clicking the splitter toggles the context panel between 50% width and fully collapsed.
- **Click-when-collapsed to expand** — If the context panel is collapsed, clicking the splitter expands it back to 50% without starting a drag.
- **Hover-only scrollbars** — Scrollbars are hidden by default and appear as thin 6px tracks on hover (macOS overlay style). Applied to the context panel.
- **Theme persistence across all entry points** — Extracted shared helpers `enrichWithThemeSettings()`, `createThemeSaver()`, and `runAskUserWithTheme()` in `index.ts`. All three entry points (`ask_user` tool, `/ask`, `/ask-debug`) now share identical theme read/save behavior.
- **Type-safe theme settings** — `getThemeSettings()` now validates stored strings against `ThemeMode`/`AnimationLevel` union types before returning.
- **Refactored constants** — Extracted `STOPWORDS` (~200 words) and `PROTECTED_ABBREVIATIONS` to `constants/stopwords.ts` and `constants/abbreviations.ts`.
- **Fully controlled AdditionalComments** — Removed half-controlled anti-pattern. Component now requires both `value` and `onChange` props.
- **Command rename** — `/ask-last` → `/ask` (shorter, more intuitive).

### Fixed
- **Mermaid rendering errors** — Added explicit `mermaid.initialize()` with `startOnLoad: false`. Defers `mermaid.run()` to `requestAnimationFrame` so the DOM is fully committed first. Errors now log via `console.warn` instead of being silently swallowed.
- **Stale closure in keydown handlers** — SingleSelect and MultiSelect now use a `stateRef` pattern: all mutable state is snapshotted into a ref, and the global keydown listener has stable dependencies (`useCallback` for handlers).
- **Short questions dropped** — `extractQuestions()` length threshold lowered from 10 to 3 characters so legitimate questions like "Why?" are not silently discarded.
- **ARIA on splitter** — Added `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow/min/max`.
- **Option ref mutation** — Removed direct `optionRefs.current = []` mutation; uses `requestAnimationFrame` for focus timing instead.
- **Consistent sendCancelled references** — All cancel buttons now pass `sendCancelled` directly instead of arrow wrappers.

### Added
- **`npm run test:with-context`** — New script that opens a WebView with the context panel, splitter, and Mermaid diagrams for visual testing.
- **`webview/src/util/html.ts`** — Shared HTML utilities: `escapeHtml()` and `highlightMatch()`.

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



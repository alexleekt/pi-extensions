# Changelog

All notable changes to `@alexleekt/pi-ask-user-glimpse` are documented in this file.

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

## [0.1.0] — 2026-05-16

### Added
- Single-select dialog with searchable options and split-pane description preview
- Multi-select dialog with checkbox-style selection
- Freeform dialog with full-height textarea
- Questionnaire dialog with per-question options (single-select, multi-select, or freeform)
- Native WebView rendering via glimpseui (macOS WKWebView / Linux GTK4 / Windows WebView2)
- Terminal fallback when glimpseui native host is unavailable
- Conflict detection for competing `ask_user` implementations (`pi-ask-user`, `rpiv-ask-user-question`)
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

### Known Issues
- No keyboard shortcuts in webview dialogs (Escape, Enter, arrow keys, Tab). All interaction is mouse/touch only. Planned for v0.1.1.
- Questionnaire always sends `kind: "selection"` even for single-select questions. The response formatter handles this correctly, but the type is inconsistent with the flat-options flow.

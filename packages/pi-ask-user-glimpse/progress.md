# Progress

## Status
All deferred work complete.

## Completed Phases

### Phase 0: Security Hardening ✅
- [x] Install DOMPurify dependency
- [x] Replace regex-based sanitizeHtml with DOMPurify
- [x] Add CSP meta tag to webview/index.html
- [x] Change mermaid securityLevel from "loose" to "strict"
- [x] Add csp attribute to HtmlContext iframe
- [x] Create 53 security tests (all passing)

### Phase 2: Component Extraction ✅
- [x] Create `RichText.tsx` — inline markdown rendering component
- [x] Create `OptionCard.tsx` — shared option card for single/multi/questionnaire
- [x] Refactor all dialog components to use `OptionCard`

### Phase 3: Inline Markdown Expansion ✅
- [x] Questionnaire question titles → `RichText` (inline markdown)
- [x] Questionnaire question descriptions → `RichText` (inline markdown)
- [x] Option titles/descriptions → `RichText` in `OptionCard`

### Phase 4: Block Markdown Support ✅
- [x] Change OptionCard from `<button>` to `<div role="button">` for block-level markdown support
- [x] Add Enter/Space keyboard handlers and focus-visible styles
- [x] Update e2e selectors

### Phase 5: Markdown Preview ✅
- [x] Create `MarkdownPreview.tsx` component with toggle
- [x] Integrate into Freeform, SingleSelect, MultiSelect, and Questionnaire comment areas

### Phase 6: HTML Context Sanitization ✅
- [x] Apply DOMPurify sanitization to raw HTML context before iframe injection

### Form Consolidation ✅
- [x] Create `useBaseDialog` hook — shared state management for all dialogs
- [x] Unify `SingleSelect` and `MultiSelect` into `SelectDialog` with `mode` prop
- [x] Create `QuestionCard.tsx` — shared question rendering for Questionnaire
- [x] Refactor `Questionnaire.tsx` to use `QuestionCard`
- [x] Update `App.tsx` to use unified components
- [x] Delete old `SingleSelect.tsx`, `MultiSelect.tsx`, and their test files

## Validation
- Unit tests: 100 pass across 8 test files
- E2E tests: 31 pass across all dialog styles
- Build: succeeds
- Typecheck: clean

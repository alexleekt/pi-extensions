# Progress

## Status
In Progress — Phase 0 (DOMPurify Security Hardening) COMPLETE

## Tasks
- [x] Install DOMPurify dependency
- [x] Replace regex-based `sanitizeHtml` with DOMPurify in `webview/src/util/markdown.ts`
- [x] Add CSP meta tag to `webview/index.html` (script-src 'unsafe-inline'; connect-src 'none')
- [x] Configure DOMPurify with strict ALLOWED_TAGS and ALLOWED_ATTR lists
- [x] Add DOMPurify hook for `target="_blank"` + `rel="noopener noreferrer"` on all safe links
- [x] Add href protocol validation (http, https, mailto, tel only)
- [x] Update security test suite — 49 tests passing, all DOMPurify migration targets activated
- [x] Build passes (`npm run build`)
- [x] All unit tests pass (`npm test` — 100 tests across 9 files)

## Files Changed
- `package.json` — Added `dompurify` and `@types/dompurify`
- `webview/src/util/markdown.ts` — Replaced regex sanitizer with DOMPurify + strict allow-list + link hardening hook
- `webview/index.html` — Added CSP meta tag for GlimpseUI WKWebView
- `webview/src/util/__tests__/markdown.security.test.ts` — Updated 49 tests, unskipped all DOMPurify targets, added link-hardening tests

## Notes
DOMPurify closes 5+ documented bypass vectors in the old regex sanitizer: HTML entity encoding, whitespace padding, backtick quotes, style attribute injection, and missing protocol schemes (blob, file, vbscript, ftp). CSP meta tag is required because GlimpseUI uses `loadHTMLString` with `baseURL: nil` — no origin, no network, inline bridge script injection.

## Next Steps
- Phase 1: Validation in real Glimpse dialog (CUA interactive test)
- Phase 2: Extract `RichText` + `OptionCard` components
- Phase 3: Inline markdown expansion to questionnaire titles, descriptions, dialog questions
- Phase 4: Full block markdown for options (requires `<button>` → `<div role="button">` refactor)

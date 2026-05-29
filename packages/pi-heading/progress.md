# Progress

## 2026-05-28
- **Investigated** "showing Working instead of my message" issue in `pi-ask-user-glimpse`
- **Searched entire codebase** for "Working" text — found zero occurrences in source code (only in markdown docs)
- **Examined title construction** in `tool/ask-user.ts` (lines 23–47, 181–188)
- **Examined dialog components** — ContextPanel, SelectDialog, Freeform, Questionnaire, DialogFooter — none contain "Working"
- **Examined `glimpseui` library** — default title is "Glimpse", not "Working"; `prompt()` does not call `show()`
- **Identified `summarizeTitle()` as likely culprit** — can produce "Working" for questions where "working" is the only non-stopword (e.g., "Are you working?")
- **Identified `pi-heading` extension** as possible source of Pi UI status bar "Working" message
- **Wrote findings** to `team-dialog-renderer-report.md`

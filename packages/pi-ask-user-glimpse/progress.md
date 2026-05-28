# Progress

## Status
In Progress

## Tasks Completed
- Added QuestionCard keyboard navigation tests (12 new tests)
  - ArrowDown/ArrowUp moves activeIndex and updates tabIndex
  - Enter/Space selects active option in single-select mode
  - Enter/Space toggles active option in multi-select mode
  - Number keys 1-9 select corresponding option by index
  - Boundary checks (ArrowDown past last, ArrowUp before first)
  - No-op when no options
- All 27 QuestionCard tests pass (15 existing + 12 new)

## Files Changed
- `webview/src/components/__tests__/QuestionCard.test.tsx` — added keyboard navigation test suite

## Notes
- Tests fire keyboard events on the `role="listbox"` container
- Verified roving tabindex via `tabindex` attribute assertions
- `Element.prototype.scrollIntoView` mocked in beforeEach for jsdom compatibility
- Pre-existing test suite issues remain: useDialogKeys.test.ts (2 failures), useBaseDialog.test.tsx (timeout), SelectDialog.test.tsx (import error)

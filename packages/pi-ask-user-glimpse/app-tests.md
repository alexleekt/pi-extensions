# App.tsx Unit Tests

## File
`webview/src/App.test.tsx`

## Coverage
App.tsx: **0% → 100%** (with mocked child components)

## Tests

| # | Test | Description |
|---|------|-------------|
| 1 | single-select renders SelectDialog | Validates payload type routing to `SelectDialog` with `mode="single"` |
| 2 | multi-select renders SelectDialog | Validates payload type routing to `SelectDialog` with `mode="multi"` |
| 3 | freeform renders Freeform | Validates payload type routing to `Freeform` component |
| 4 | questionnaire renders Questionnaire | Validates payload type routing to `Questionnaire` component |
| 5 | context panel with context | Verifies `ContextPanel` receives `context`, `contextFormat`, and `question` props |
| 6 | context panel without context | Verifies `ContextPanel` receives empty `context` when not provided |
| 7 | FooterContext provided | Verifies footer container element exists in the DOM |
| 8 | invalid payload error | Verifies `"Missing or invalid ask_user payload"` is rendered when payload is `null` |
| 9 | missing payload error | Verifies error message when `__ASK_USER_PAYLOAD__` is deleted |
| 10 | unknown type message | Verifies `"Unknown prompt type: unknown-type"` fallback for unrecognized types |
| 11 | context stripped from dialog payload | Verifies `componentPayload` strips `context` to avoid double rendering |

## Mocking Strategy

- **Dialog components**: `SelectDialog`, `Freeform`, `Questionnaire` mocked with `vi.mock` to return testid-bearing divs
- **ContextPanel**: Mocked to capture props and render a testid-bearing div
- **ErrorBoundary**: Mocked as a transparent pass-through wrapper
- **Window payload**: `window.__ASK_USER_PAYLOAD__` set directly per test, deleted in `beforeEach`
- **Dynamic import**: `import("./App")` used inside each test to ensure mocks are hoisted before App imports its dependencies

## ContextPanel Test Fix

The `marked.parse` mock in `ContextPanel.test.tsx` was returning `<h1>Hello\n\nWorld</h1>` for the input `"# Hello\n\nWorld"`, which failed the `.toContain("<h1>Hello</h1>")` assertion. Fixed the mock to split on newlines and only put the first line in the `<h1>` tag.

## Results

- **Unit tests**: 224 passing (19 test files)
- **E2e tests**: 31 passing
- **Typecheck**: Clean
- **Build**: Successful

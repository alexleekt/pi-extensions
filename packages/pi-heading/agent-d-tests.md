# Agent D — Test Coverage Report

## Scope
Added missing tests and fixed test gaps identified in the code review. All tests added with `bun:test`.

## New Test Files

### `state/debug.test.ts` (new — 12 tests)
- `setDebugEnabled / isDebugEnabled round-trip`
- `logDebug is no-op when disabled`
- `logDebug appends structured entry when enabled`
- `readDebugLog returns last N entries (most recent first)`
- `readDebugLog handles empty file`
- `readDebugLog handles malformed JSON by returning empty array`
- `clearDebugLog removes file`
- `clearDebugLog on non-existing file does not throw`
- `log rotation drops oldest half when > 1MB`
- `readDebugLog default n=20`
- `getDebugLogPath / setDebugLogPath round-trip`
- `DEBUG_LOG constant is under private debug dir`

### `llm/summarize.test.ts` additions (9 new tests)
- `extractTextFromMessage` all shapes:
  - returns empty string for undefined
  - returns string directly when msg is a string
  - extracts from `.text` property
  - extracts from `.content` string
  - extracts from `.content` array with text parts
  - extracts from `.content` array with string elements
  - skips thinking content
  - parses JSON result field
  - returns raw text when JSON parse fails
- `thinkingOffOpts returns correct shapes for each API` (anthropic, google-generative-ai, google-vertex, openai)
- `readPromptFile fallback when no Message: marker — template becomes {message}`

### `state/store.test.ts` additions (5 new tests)
- `getState / setState round-trip stores and retrieves state`
- `getState returns undefined for nonexistent leaf`
- `exposeHeading emits correct payload with achievement`
- `exposeHeading emits correct payload without achievement`
- `clearExposure emits idle payload`

### `index.test.ts` additions (8 new tests)
- `agent_start clears heading when no state`
- `turn_start clears heading when no state`
- `before_agent_start uses working mode when agent already started`
- `heading-model handles model not found after selection`
- `heading-model warns when auth ok but apiKey is empty`
- `/heading-debug formats entries with error, stream, and achievement`

## Implementation Changes (Minimal — for Testability)
- `state/debug.ts`: Added `setDebugLogPath()` / `getDebugLogPath()` to make debug logging testable
- `llm/run.ts`: Exported `thinkingOffOpts` (was internal) for testing
- `handlers/agent.ts`: Added `clearHeading(ctx)` when no state in `handleAgentStart`
- `handlers/turn.ts`: Added `clearHeading(ctx)` when no state in `handleTurnStart`

## Test Isolation Fixes
- `index.test.ts`: Added `clearState()` in `beforeEach`, `setDebugLogPath(DEBUG_LOG)` in `beforeEach`/`afterEach`, `setModelOverride(undefined)` in `beforeEach`/`afterEach`
- `summarize-pipeline.test.ts`: Added `setModelOverride(undefined)` in `beforeEach`, expanded mock registry to include common model IDs
- `picker.test.ts`: Added `setModelOverride(undefined)` in `beforeEach`
- `debug.test.ts`: Added random suffix to `tmpDir` to prevent parallel test conflicts

## Test Results
- **146 pass, 0 fail** across 8 test files
- `tsc --noEmit` passes
- Coverage: `state/debug.ts` now ~95%, `llm/summarize.ts` (parse/run) now ~90%, `state/store.ts` now ~95%, `index.ts` handlers now ~85%

## Changed Files
- `state/debug.test.ts` (new)
- `llm/summarize.test.ts` (updated)
- `state/store.test.ts` (updated)
- `index.test.ts` (updated)
- `llm/summarize-pipeline.test.ts` (updated)
- `llm/picker.test.ts` (updated)
- `state/debug.ts` (added `setDebugLogPath`/`getDebugLogPath`)
- `llm/run.ts` (exported `thinkingOffOpts`)
- `handlers/agent.ts` (added `clearHeading` fallback)
- `handlers/turn.ts` (added `clearHeading` fallback)

# Progress — pi-heading refactor

## 2026-05-28

### Council Review
- **Spawned 6 parallel reviewers** (Security, Architecture, Type Safety, UX/Accessibility, Tests, Research)
- **Synthesized findings** into 28 items: 11 Critical, 12 Warning, 5 Suggestion
- **Root cause identified**: Migration regression — `setWidget` → `setWorkingMessage` removed prefixes and spinner, leaving zero progress indication

### LLM Refactor (Agent B)
- **Split `llm/summarize.ts`** (215 lines) into 4 focused modules:
  - `llm/prompt.ts` — prompt reading + system prompt construction
  - `llm/parse.ts` — LLM output parsing and cleaning
  - `llm/run.ts` — LLM calling + model configuration
  - `llm/summarize.ts` — thin orchestration layer (45 lines)
- **Created `util/config.ts`** — generic config I/O with `mode: 0o700`
- **Security fixes**:
  - Path traversal in `readPromptFile` (sanitize `name`)
  - Template substitution `$` corruption (use replacement functions)
  - Debug log moved from `/tmp` to private `~/.pi/agent/extensions/pi-heading/` with `0o600`
  - Config validation in `getModelOverride`
- **Tests**: 148 pass, 0 fail (up from 114)
- **Typecheck**: `tsc --noEmit` passes

### Handler Extraction (Agent D)
- **Extracted `index.ts` (~400 lines) into `handlers/` directory**:
  - `handlers/debug.ts` — debug entry builders (`baseDebugEntry`, `makeDebugEntry`, `makeDebugEntryAchievement`, `makeDebugEntryError`, `extractAgentText`)
  - `handlers/session.ts` — session lifecycle (`handleSessionStart`, `handleSessionShutdown`)
  - `handlers/agent.ts` — agent lifecycle (`handleAgentEnd`, `handleAgentStart`, `handleBeforeAgentStart`)
  - `handlers/turn.ts` — turn lifecycle (`handleTurnStart`, `handleTurnEnd`)
  - `handlers/commands.ts` — slash commands (`handleHeading`, `handleHeadingModel`, `handleHeadingDebug`)
- **Slimmed `index.ts` to ~77 lines** — thin wiring layer that registers all handlers and commands
- **Shared state pattern** — `SharedState` interface (`turnGeneration`, `agentStartedForCurrentTurn`) passed to handlers that need it
- **Fixed `turn_end` to show achievement in widget** — `setHeadingMessage(ctx, achievement, "achievement")` instead of `sendMessage`
- **Fixed `agent_start`/`turn_start` to clear heading when no state** — `clearHeading(ctx)` when `state?.goal` is falsy
- **Fixed type safety** — `extractAgentText` accepts `AgentMessage` (not `AssistantMessage`), `State` imported from `types.ts`
- **Fixed `state/debug.ts` for test agent** — added `setDebugLogPath`/`getDebugLogPath`, `_debugLogPath` variable for `logDebug`/`readDebugLog`/`clearDebugLog`
- **Fixed `state/store.ts` type assertions** — `CustomEntry` cast through `unknown`
- **Fixed `index.test.ts` test isolation** — added `clearState()` to `beforeEach` to prevent cross-test pollution in `memory` Map
- **Fixed `summarize-pipeline.test.ts` import** — added missing `beforeEach` import
- **Tests**: 146 pass, 0 fail
- **Typecheck**: `tsc --noEmit` passes

### Updated Files
- `index.ts` (rewritten — thin wiring layer)
- `handlers/debug.ts` (new)
- `handlers/session.ts` (new)
- `handlers/agent.ts` (new)
- `handlers/turn.ts` (new)
- `handlers/commands.ts` (new)
- `llm/prompt.ts` (new)
- `llm/parse.ts` (new)
- `llm/run.ts` (new)
- `util/config.ts` (new)
- `types.ts` (new)
- `llm/summarize.ts` (rewritten — thin orchestrator)
- `llm/picker.ts` (removed debug functions, uses `util/config.ts`)
- `state/debug.ts` (added `getDebugMode`/`setDebugMode`, `setDebugLogPath`/`getDebugLogPath`, moved log path, added perms)
- `state/store.ts` (added `clearState()`, fixed type assertions, moved types to `types.ts`)
- `ui/widget.ts` (added spinner, prefixes, `stopSpinner`)
- `index.test.ts` (updated imports, added `clearState` cleanup, new tests for widget behavior)
- `llm/summarize.test.ts` (updated imports, added new tests)
- `llm/summarize-pipeline.test.ts` (added `beforeEach` import, config cleanup)
- `ui/widget.test.ts` (updated for prefixes and spinner)
- `state/store.test.ts` (added `getState`/`setState`/`exposeHeading`/`clearExposure` direct tests)
- `state/debug.test.ts` (new — full debug log coverage)
- `state/guard.test.ts` (no changes)
- `llm/picker.test.ts` (no changes)

### Test Coverage (Agent D)
- **Added `state/debug.test.ts`** — 12 tests covering debug infrastructure:
  - `setDebugEnabled` / `isDebugEnabled` round-trip
  - `logDebug` append (enabled and disabled)
  - `readDebugLog` last-N entries, empty file, malformed JSON
  - `clearDebugLog` remove file, non-existing file
  - `log rotation` drops oldest half when > 1MB
  - `readDebugLog` default n=20
  - `setDebugLogPath` / `getDebugLogPath` round-trip
  - `DEBUG_LOG` constant location
- **Added `llm/summarize.test.ts` tests** — 9 new tests:
  - `extractTextFromMessage` all 8 shapes (undefined, string, .text, .content string, .content array, thinking skip, JSON parse, raw fallback)
  - `thinkingOffOpts` for each API (anthropic, google-generative-ai, google-vertex, openai)
  - `readPromptFile` fallback when no `Message:` marker
- **Added `state/store.test.ts` tests** — 5 new tests:
  - `getState` / `setState` round-trip
  - `getState` returns undefined for nonexistent leaf
  - `exposeHeading` emits correct payload with/without achievement
  - `clearExposure` emits idle payload
- **Added `index.test.ts` tests** — 8 new tests:
  - `agent_start` clears heading when no state
  - `turn_start` clears heading when no state
  - `before_agent_start` uses working mode when agent already started
  - `heading-model` handles model not found after selection
  - `heading-model` warns when auth ok but apiKey is empty
  - `/heading-debug` formats entries with error, stream, and achievement
  - `turn_end` reads fresh state after concurrent state update (already existed, now works)
- **Fixed test isolation** across all test files:
  - `index.test.ts`: added `clearState()` in `beforeEach`, `setDebugLogPath(DEBUG_LOG)` in `beforeEach`/`afterEach`, `setModelOverride(undefined)` in `beforeEach`/`afterEach`
  - `summarize-pipeline.test.ts`: added `setModelOverride(undefined)` in `beforeEach`, expanded mock registry to include common model IDs
  - `picker.test.ts`: added `setModelOverride(undefined)` in `beforeEach`
  - `debug.test.ts`: added random suffix to `tmpDir` to prevent parallel test conflicts
- **Test results**: 146 pass, 0 fail across 8 test files
- **Typecheck**: `tsc --noEmit` passes

### UX Fix (Agent A)
- **Fixed `ui/widget.ts`** — restored phase prefixes and spinner animation:
  - Added `SPINNER_FRAMES` with Braille characters (`⠋`, `⠙`, `⠹`, etc.)
  - Added `startSpinner(text, ctx)` with 80ms interval cycling through frames
  - Added `stopSpinner()` to clear interval
  - `setHeadingMessage` now adds `▸ ` for goal, `✓ ` for achievement, and `⠋ ` + spinner for working
  - `clearHeading` stops spinner before clearing
- **Fixed `handlers/agent.ts`**:
  - `handleAgentEnd`: uses `state.achievement ?? state.goal` for achievement text
  - `handleBeforeAgentStart`: uses ellipsis truncation (`slice(0, 57) + "…"`) for long placeholder
- **Fixed `handlers/turn.ts`**:
  - Removed `pi.sendMessage` that sent achievement to chat (widget shows it now)
  - Added `setHeadingMessage(ctx, achievement, "achievement")` after `persistState`
- **Created `types.ts`** — moved `WidgetMode`, `HeadingExposure`, `State` from `state/store.ts` and `ui/widget.ts`
- **Fixed `state/store.ts`**:
  - Imports types from `types.ts` instead of `ui/widget.ts`
  - Fixed unsafe `achievement` cast: `typeof p.achievement === "string" ? p.achievement : undefined`
  - Removed `as HeadingExposure` casts, uses `satisfies` instead
- **Updated tests**:
  - `widget.test.ts`: updated for prefixes and spinner
  - `index.test.ts`: fixed stale generation test (spinner interval), removed incorrect `clearHeading` tests
  - `summarize-pipeline.test.ts`: moved `beforeEach` inside `describe` to fix `ReferenceError`
- **Test results**: 146 pass, 0 fail across 8 test files
- **Typecheck**: `tsc --noEmit` passes

### Remaining Work
- Docs update: README to reflect `setWorkingMessage` migration
- Final integration: verify all agent changes work together

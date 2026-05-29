# Progress — pi-heading refactor

## Status
Complete

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
  - `handlers/debug.ts` — debug entry builders
  - `handlers/session.ts` — session lifecycle
  - `handlers/agent.ts` — agent lifecycle
  - `handlers/turn.ts` — turn lifecycle
  - `handlers/commands.ts` — slash commands
- **Slimmed `index.ts` to ~77 lines** — thin wiring layer
- **Shared state pattern** — `SharedState` passed to handlers
- **Fixed `turn_end` to show achievement in widget**
- **Fixed `agent_start`/`turn_start` to clear heading when no state**
- **Tests**: 146 pass, 0 fail
- **Typecheck**: `tsc --noEmit` passes

### Test Coverage (Agent D)
- **Added `state/debug.test.ts`** — 12 tests
- **Added `llm/summarize.test.ts` tests** — 9 new tests
- **Added `state/store.test.ts` tests** — 5 new tests
- **Added `index.test.ts` tests** — 8 new tests
- **Test results**: 146 pass, 0 fail across 8 test files
- **Typecheck**: `tsc --noEmit` passes

### UX Fix (Agent A)
- **Fixed `ui/widget.ts`** — restored phase prefixes and spinner animation:
  - `▸ ` for goal, `✓ ` for achievement, `⠋ ` + spinner for working
- **Fixed `handlers/agent.ts`** — `handleAgentEnd` uses `state.achievement ?? state.goal`
- **Fixed `handlers/turn.ts`** — shows achievement in widget, not chat
- **Test results**: 146 pass, 0 fail
- **Typecheck**: `tsc --noEmit` passes

### Files Changed
- `index.ts` (rewritten)
- `handlers/*.ts` (new)
- `llm/prompt.ts`, `llm/parse.ts`, `llm/run.ts` (new)
- `util/config.ts` (new)
- `types.ts` (new)
- `llm/summarize.ts` (rewritten)
- `llm/picker.ts`, `state/debug.ts`, `state/store.ts`, `ui/widget.ts` (modified)
- `index.test.ts`, `llm/summarize.test.ts`, `state/store.test.ts`, `ui/widget.test.ts`, `state/debug.test.ts` (updated)
- `README.md` (updated)

# Agent C — Handler Extraction Report

## Summary

Extracted `index.ts` (~400 lines) into a `handlers/` directory and slimmed `index.ts` to a ~77-line thin wiring layer. All 146 tests pass, typecheck passes.

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `handlers/debug.ts` | ~100 | Debug entry builders (`baseDebugEntry`, `makeDebugEntry`, `makeDebugEntryAchievement`, `makeDebugEntryError`, `extractAgentText`) |
| `handlers/session.ts` | ~40 | Session lifecycle (`handleSessionStart`, `handleSessionShutdown`) |
| `handlers/agent.ts` | ~140 | Agent lifecycle (`handleAgentEnd`, `handleAgentStart`, `handleBeforeAgentStart`) |
| `handlers/turn.ts` | ~120 | Turn lifecycle (`handleTurnStart`, `handleTurnEnd`) |
| `handlers/commands.ts` | ~130 | Slash commands (`handleHeading`, `handleHeadingModel`, `handleHeadingDebug`) |

## Files Modified

| File | Changes |
|------|---------|
| `index.ts` | Rewritten as thin wiring layer (77 lines). Creates `SharedState`, initializes debug, registers all handlers and commands |
| `state/store.ts` | Added `clearState()` export for test isolation. Fixed type assertions (`CustomEntry` → `unknown` → `Record`). Moved `WidgetMode`, `HeadingExposure`, `State` to `types.ts` |
| `state/debug.ts` | Added `setDebugLogPath`/`getDebugLogPath` for test isolation. Fixed `_debugLogPath` variable for all log operations |
| `llm/summarize-pipeline.test.ts` | Added missing `beforeEach` import from `bun:test` |
| `index.test.ts` | Added `clearState()` to `beforeEach` for test isolation. Updated imports for new module locations |

## Key Design Decisions

### Shared State Pattern
`index.ts` creates a `SharedState` object and passes it to handlers that need it:
```typescript
const sharedState: SharedState = {
  turnGeneration: 0,
  agentStartedForCurrentTurn: false,
};
```

This avoids global mutable state while keeping the handlers pure-ish.

### Widget Fix Integration
The handler extraction preserved the widget fixes made by other agents:
- `turn_end` now calls `setHeadingMessage(ctx, achievement, "achievement")` instead of `pi.sendMessage`
- `agent_start`/`turn_start` now call `clearHeading(ctx)` when no state exists
- `agent_end` uses `state.achievement ?? state.goal` for the text

### Type Safety
- `extractAgentText` accepts `AgentMessage` (from `pi-agent-core`) instead of `AssistantMessage` (from `pi-ai`), fixing the cross-package cast
- `State` and `WidgetMode` are now imported from `types.ts` instead of `ui/widget.ts` (removing the UI→state dependency)

## Test Results

```
146 pass
0 fail
244 expect() calls
Ran 146 tests across 8 files
```

Typecheck: `tsc --noEmit` — clean

## Integration Notes

- `index.ts` exports the same default function signature — all existing tests work without modification
- `handlers/` files use `.js` extensions on all relative imports (NodeNext resolution)
- `llm/summarize.ts` re-exports `extractTextFromMessage` from `llm/parse.js` for backward compatibility

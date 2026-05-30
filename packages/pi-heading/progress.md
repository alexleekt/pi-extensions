# Progress

## Status
Completed

## Tasks
- [x] Move 5 review scratchpad files to `docs/reviews/2026-05-28/`
- [x] P0 bug fixes: B6, B7, B8, W1
  - B6: `agentEndGeneration` counter prevents post-agent_end async clobber
  - B7: `currentPlaceholder` cache prevents stale state from overwriting placeholder
  - B8: `deleteState()` clears in-memory store on session_start when no replay
  - W1: `lastExposed` cache deduplicates event bus emissions in turn_start

## Files Changed
- `handlers/agent.ts` — B6 + B7 fixes
- `handlers/session.ts` — B8 fix + SharedState interface updates
- `handlers/turn.ts` — B7 + W1 fixes
- `state/store.ts` — added `deleteState()` export
- `index.ts` — sharedState initialization for new fields
- `index.test.ts` — updated/added tests for new behavior
- Moved: 5 review scratchpad files → `docs/reviews/2026-05-28/`

## Test Results
151 pass, 0 fail, 266 expect() calls

## Notes
- All `setWorkingVisible` calls removed in prior commit (27dfc17)
- Current fix addresses the race conditions and UX regressions introduced by that removal
- `currentPlaceholder` is cleared by: agent_end, async completion, or new before_agent_start

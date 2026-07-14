# ADR 0003: Intermediate Tool-Call Turns

## Status

Accepted in part; rendering implementation superseded by [ADR 0004](0004-native-working-message-lifecycle.md)

## Context

A Pi agent run may contain multiple turns. When a turn requests tools, Pi emits `turn_end` with one or more `toolResults`, then starts another turn to process those results. The assistant text in that intermediate turn is transitional rather than a completed outcome.

Treating every `turn_end` as final caused premature achievement generation and misleading completion state. The original implementation also managed a custom spinner and widget, but that rendering design has since been replaced by Pi's native working-message row.

## Decision

Use `event.toolResults.length` to distinguish intermediate and final turns:

| Turn type | `toolResults` | Achievement summarization |
|-----------|---------------|---------------------------|
| Intermediate tool-call turn | `> 0` | Skip |
| Final response turn | `=== 0` | Run |

Pi owns spinner animation. pi-heading only updates text through `ctx.ui.setWorkingMessage()` and finalizes run state on `agent_settled`.

```typescript
const hasToolResults = (event.toolResults?.length ?? 0) > 0;
if (hasToolResults) return;

// Summarize the final assistant response as the achievement.
```

## Consequences

- Achievement summarization runs once, for the final response.
- Transitional tool-request text is not mistaken for an accomplishment.
- No extra model calls run between tool-call turns.
- Indicator animation and visibility remain Pi's responsibility.
- Intermediate assistant text is intentionally not captured as an achievement.

## Related

- [ADR 0001: Anti-Ghosting Widget](0001-anti-ghosting-widget.md) — Historical rendering context; superseded.
- [ADR 0002: Widget Phase Indicators](0002-widget-phase-indicators.md) — Historical phase design; superseded.
- [ADR 0004: Native Working Message Lifecycle](0004-native-working-message-lifecycle.md) — Current rendering and lifecycle contract.

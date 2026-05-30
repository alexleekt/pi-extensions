# ADR 0002: Widget Phase Indicators — Animated Working State

## Status
Accepted

## Context
Users report that the static one-line widget feels "dead" — there's no visual feedback that the agent is actively working on the displayed goal. The widget shows the same static text throughout the entire turn, making it hard to tell at a glance whether the agent is still generating a response or has finished.

ADR 0001 explicitly rejected animations to prevent ghosting from pi-tui border components. However, that decision was scoped to **component-based** animation (`Box`, `Container`, custom timers). It did not consider plain-text character rotation via `setWidget()` string updates, which carries zero ghosting risk (no border fragments).

Pi also provides a native `ctx.ui.setWorkingMessage()` loading indicator, but it lives in Pi's own status area, not in the widget line. Users want the **goal text itself** to feel alive, not a generic "Working..." message elsewhere on screen.

## Decision
Add three visual prefixes to the widget line, driven by Pi lifecycle events:

| Phase | Prefix | Event trigger | Description |
|-------|--------|---------------|-------------|
| **Goal-displayed** | `▸` | `summarize()` completes | Static. The current intent. |
| **Working** | `⠋` (Braille spinner) | `agent_start` / `turn_start` | Animated. Plain-text character rotation via `setInterval` + `setWidget()`. Agent is executing. Restarts at every `turn_start` between tool-call turns. |
| **Achievement-displayed** | `✓` | `summarizeAchievement()` completes | Static. The agent's output from the last turn. |

### Rules
1. **Animation is plain-text only.** Braille characters `⠋⠙⠹⠸⠼⠴⠦⠧` rotated at ~120ms. No pi-tui `Component`, no `Box`, no background color.
2. **Animation runs during the entire agent execution.** The spinner starts at `agent_start` and restarts at every `turn_start` between tool-call turns. It stops at each `turn_end` to show the completion prefix (`✓`). It does not run during LLM summarization (which is async fire-and-forget).
3. **~~Suppress Pi's native loader.~~** ❌ *Superseded 2026-05-29.* The Pi SDK's `setWorkingVisible(false)` hides the **entire** working loader row, not just the native "Working" label. This made our custom `setWorkingMessage()` text invisible. The widget now coexists with Pi's native loader instead of suppressing it. See commit `27dfc17`.

## Consequences

- **Positive:** Users can tell at a glance whether the agent is working or done. The widget tells a mini-story per turn: ▸ → ⠋ → ✓.
- **Positive:** Plain-text animation preserves ADR 0001's anti-ghosting guarantee. Differential renderer overwrites the single line in place.
- **Positive:** No new dependencies. `setInterval` and `setWidget()` are extension-API primitives.
- **Negative:** Adds event-hooks complexity. `pi-heading` now listens to `agent_start` in addition to `before_agent_start` and `turn_end`.
- **Negative:** Rapid `setWidget()` updates may have minor CPU cost, though Braille rotation at 120ms is negligible.
- **Negative:** Users who preferred the purely static minimalism lose that option (no toggle planned in this ADR; can be added later).

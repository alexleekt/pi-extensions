# ADR 0004: Native Working-Message Lifecycle

## Status

Accepted

## Context

Earlier versions rendered phase prefixes, owned a spinner timer, and emitted a custom achievement message into the transcript. That duplicated Pi's working UI, competed with other extensions, and treated `agent_end` as final even though modern Pi can retry, compact and retry, or process queued follow-ups after a low-level run ends.

Pi 0.80.4 added `agent_settled`, which fires only when no automatic continuation remains. Pi also exposes an abort signal to nested model calls and owns the working indicator independently from the working-message text.

## Decision

1. Render goal and achievement text only through `ctx.ui.setWorkingMessage()`.
2. Let Pi own the working indicator; do not call `setWorkingIndicator()` or run an animation timer.
3. Do not add achievement cards or custom messages to the transcript.
4. Use `agent_settled` rather than `agent_end` for final UI stabilization.
5. Pass `ctx.signal` to summary model calls and silently ignore cancellation.
6. Replay state after `session_start` and `session_tree` so the working message follows the active branch.
7. Keep lifecycle mode in persisted state and `heading:state` events even though the rendered text has no decorative phase prefix.

## Consequences

- **Positive:** One native UI row, no competing animation, no duplicate transcript output.
- **Positive:** Final state is not announced between retries or queued follow-ups.
- **Positive:** Escape/abort cancels nested summary requests.
- **Positive:** `/tree` navigation restores the selected branch's heading.
- **Negative:** Goal and achievement are distinguished by content and event metadata, not icons.
- **Negative:** Requires Pi 0.80.4 or newer.

## Alternatives rejected

- **Custom `setWorkingIndicator()` frames:** duplicates Pi's loader and adds no heading-specific information.
- **Automatic `pi.setSessionName()`:** risks overwriting user-owned `/name` metadata and couples two separate concepts.
- **Entry renderer for achievements:** keeps content out of model context but still adds transcript noise, which the one-line contract intentionally avoids.

## Supersedes

- ADR 0002's phase-prefix and spinner decision.
- ADR 0003's spinner-continuity implementation; its `toolResults` distinction remains valid.

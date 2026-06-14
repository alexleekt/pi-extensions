# ADR 0002: Status Widget Dismissal Lifecycle

## Status

Accepted

**Supersedes parts of:** [0001-async-status-widget.md](./0001-async-status-widget.md) — specifically the "Mitigations" section of 0001, which claimed `try/finally` and "auto-clear after a short delay" were already in place. Neither was implemented; this ADR records the *actual* dismissal contract.

## Context

The `/event-horizon` command's status widget was designed as a **non-blocking surface above the editor** (see ADR 0001). It shows the instance list immediately, populates each row's health as `/health` checks resolve, and was expected to "auto-clear after a short delay" per the original ADR.

In practice, the widget has no auto-clear behavior. It only clears on (a) the next `/event-horizon` invocation or (b) the `input` event when the user starts typing. Between those events, the widget stays anchored above the editor — visually correct (it shows up-to-date state) but layout-intrusive, blocking prime real estate near the input area.

The user has reported this as "the widget sticks around forever." The underlying issue is **layout, not data freshness** — the rows are accurate, they just don't step out of the way when the user moves on to a new task.

## Decision

The status widget dismisses on the earliest of three signals. No timer-based dismissal.

### Trigger 1: `agent_start` event (canonical)

A new `pi.on("agent_start", ...)` listener at extension load time calls `setWidget(STATUS_WIDGET_KEY, undefined)` unconditionally. This is the canonical "the user has moved on" signal: as soon as a new turn begins, the widget is no longer useful context. The call is a no-op if no widget is set, so unconditional dispatch is safe.

**Why `agent_start` and not `turn_start` or `message_start`:**
- `agent_start` fires earliest — before any LLM call. The widget clears before the user sees the spinner or the input gets re-rendered.
- `turn_start` would re-clear between internal agent loop iterations, which is more aggressive than needed and could flicker if the user invokes `/event-horizon` *during* a turn.
- `message_start` fires when the assistant *begins streaming tokens* — too late, the user has already seen the spinner.

**Why no flag check on the listener:** `setWidget(key, undefined)` is a no-op when no widget is set, so an unconditional call has no observable effect when the widget is absent. A module-scope "is widget active?" flag would be one more piece of state for zero benefit.

### Trigger 2: `input` event (defense in depth)

The existing `pi.on("input", ...)` listener already clears the widget. Keep it. The user has signaled "I'm about to send something" — clearing the widget matches the visual cleanup. (The listener stays at extension load, not inside the command handler, because `input` can fire long after the command handler returns.)

### Trigger 3: Re-invocation of `/event-horizon`

Every invocation starts with `setWidget(STATUS_WIDGET_KEY, undefined)` and aborts any in-flight checks from a prior invocation via a module-scope `AbortController`. The aborted signal causes the prior run's per-instance promises to short-circuit *before* calling `updateWidget()`, so a slow prior run cannot overwrite the new run's in-flight row state. The per-instance `signal.aborted` check runs after each `await` (after `checkInstance`, after `discoverModelSpecs`) — three checks per instance, ~3 lines of code.

The per-fetch `AbortSignal.timeout(3000)` is kept untouched. The prior-invocation controller and the per-fetch timeout are **orthogonal signals** — the timeout lives with the fetch, the prior-invocation lives with the callback. Composing them would require `AbortSignal.any()`, which is Node 20.3+ and the monorepo's `engines.node` floor is `>=18.0.0`.

### `try/finally` for partial-state flush

The status-mode handler's parallel-check block is wrapped in `try { ... } finally { updateWidget(); }`. The `finally` ensures the final render runs even if any of the per-instance promises throws *outside* its `Promise.allSettled` boundary (e.g. a renderWidget() bug or a YAML write failure in the toggle branch — though the toggle branch is outside the try block, since it never touches the widget). The widget is **not** cleared in the `finally` — partial state is useful diagnostic info (e.g. "local: online, staging: timeout, prod: checking") and `agent_start` will clear it at the next turn boundary.

### What we explicitly rejected

- **Time-based auto-dismiss** (e.g. 3 seconds after `Promise.allSettled` resolves). Two reasons:
  1. The user might still be reading the widget when the timer fires — yanking it away mid-read is worse than letting it persist.
  2. The `pi-event-horizon-async-widget-pattern` card warned that timers can race with the next invocation: a prior invocation's stale timer could clear a newer invocation's widget. The per-invocation clear-at-start of the handler mostly mitigates this, but stacking T1 (timer) on top of T2 (event) is complexity for a layout problem that's already solved by T2.
- **Moving the widget to `setWorkingMessage()`** (the working-indicator slot, like `pi-heading` did). Loses the multi-row layout. Layout problem is solvable with timing/event triggers without sacrificing the row format.
- **Pushing to chat transcript** via `pi.sendMessage({ display: true, triggerTurn: false })`. Becomes a permanent record, accumulates over time. The user wanted transient, not historical.

## Consequences

### Positive

- The widget steps out of the way the moment the user moves on to the next task (`agent_start` is the dominant signal)
- Re-running the command mid-flight is clean: prior run's stale state cannot overwrite the new run's row updates
- Partial state on error is preserved as diagnostic info
- No timer means no timer-related race conditions, no timer cleanup on extension unload
- No flag state means the listener is a one-liner

### Negative

- If the user runs `/event-horizon` and then *does nothing* (just stares at the terminal), the widget persists indefinitely. This is the same behavior as before — the widget only clears on a real next-event signal. We accept this because the alternative (a timer) was rejected above.
- The `agent_start` listener fires for *every* agent turn in the session, including turns that have nothing to do with the widget. The cost is a single `setWidget(key, undefined)` call per turn — negligible.
- `AbortController` is the only state in the extension outside the per-invocation closures. If the extension is loaded into multiple sessions in the same process, the `currentAbort` could in theory point at a different session's controller. In practice, Pi loads extensions per-session, so this is not a real concern. (A `WeakMap<sessionId, AbortController>` would be the fix if multi-session loading becomes a thing.)

### Mitigations

- The `input` listener remains as a defense-in-depth clear. If `agent_start` ever fails to fire (e.g. a Pi internal change), the widget still clears on user input.
- The first line of the `/event-horizon` command handler is still `setWidget(STATUS_WIDGET_KEY, undefined)`, so the *very first* `updateWidget()` after a re-invocation sees a clean slate.

## Implementation

- Module-scope `let currentAbort: AbortController | null = null;` in `index.ts`, declared just above the extension factory.
- New `pi.on("agent_start", ...)` listener at extension load time, alongside the existing `pi.on("input", ...)` listener.
- Status-mode handler: abort + new controller + try/finally around the parallel `Promise.allSettled` block.
- Widget key extracted to a `STATUS_WIDGET_KEY` constant (used in 4 places now).
- The toggle branch (`<instance> <anthropic|openai|responses>`) is **outside** the try/finally — it uses `ctx.ui.notify` and never touches the widget, so it doesn't need the partial-state flush or the abort coordination.

## Related

- [0001-async-status-widget.md](./0001-async-status-widget.md) — the original `setWidget` vs `custom` overlay decision
- [[pi-event-horizon-async-widget-pattern]] — original "no timer" insight
- [[pi-event-horizon-review-loop-pattern]] — review loop that originally surfaced the layout issue
- [[pi-recap-rebuild-anti-ghosting]] — adjacent anti-ghosting work in `pi-recap`
- [[pi-heading-setworkingmessage-migration]] — the alternative we considered and rejected

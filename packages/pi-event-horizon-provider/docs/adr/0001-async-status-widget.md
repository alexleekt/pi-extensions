# ADR 0001: Async Status Display via `setWidget()`

## Status

Accepted

## Context

The `/event-horizon` command blocks the user until all server health checks complete. For multiple instances, this can take 5–10 seconds before any output appears. We need to show the server list immediately and populate health status asynchronously.

Three UI patterns were evaluated:

1. **`ctx.ui.custom()` with overlay** — A centered modal overlay that updates rows in-place. `custom()` returns `Promise<T>` and blocks until `done()` is called. Making it non-blocking requires fire-and-forget execution with a captured `done()` callback held in a closure. This is fragile: the overlay lifecycle becomes decoupled from the command handler, and a leaked callback or uncaught error leaves a zombie overlay.

2. **`ctx.ui.notify()` twice** — First notification shows the list with "checking..." placeholders; second notification shows final results. Simple to implement, but produces two separate notifications rather than a single live surface. The user experience is choppy.

3. **`ctx.ui.setWidget()`** — A temporary widget above/below the editor. Genuinely non-blocking, does not steal focus, and can be updated dynamically by calling `setWidget()` again with the same key. The widget auto-clears after all checks resolve or after a timeout.

## Decision

Use **`ctx.ui.setWidget()`** with a component factory for the `/event-horizon` command.

The widget:
- Appears instantly when the command runs
- Shows every configured instance with a "checking..." placeholder
- Updates each row in-place as its `/health` check resolves
- Auto-clears after a short delay once all checks are done

## Consequences

### Positive
- The user sees the server list **immediately** with zero blocking time
- No focus management or overlay lifecycle complexity
- Simple component updates via `tui.requestRender()` inside the factory
- Easy to add a timeout-based auto-clear

### Negative
- The widget lives in the editor chrome, not the chat transcript. If the user scrolls up, the widget stays anchored near the editor
- A crash or exception before auto-clear could leave the widget visible until the next `/event-horizon` run

### Mitigations
- Use `setWidget(key, undefined)` as the first line of every `/event-horizon` invocation to clear any stale widget
- Wrap the async work in `try/finally` to guarantee the final `setWidget(key, undefined)` call
- Cap health-check timeout at 3s (down from 5s) so the widget updates quickly even for offline instances

# Code Review: `index.ts` on `event-horizon-async-status`

**Commit:** `ac660860` — "feat: async /event-horizon status with live-updating widget"
**Scope:** `packages/pi-event-horizon-provider/index.ts`
**Checks:** TypeScript types, async patterns, error handling, resource leaks, race conditions, formatting artifacts.

---

## Correct

### 1. `checkInstance` return type is correctly typed
- `response?: HealthResponse` is properly optional.
- Success path sets `response: data` (line ~267).
- HTTP-error and exception paths omit `response`, which is valid because the property is optional.
- `TypeScript --noEmit` compiles clean; Biome lint passes.

### 2. No dangling Promises or unhandled rejections
- `checkInstance` wraps `fetch` in `try/catch` and always returns a resolved value.
- `discoverModelSpecs` wraps each `fetch` in `try/catch` with fall-through.
- The command handler uses `Promise.allSettled(promises)` (line ~420), which never rejects, so no unhandled rejection path exists.
- Every created Promise is awaited before the handler returns.

### 3. `Promise.allSettled` pattern is appropriate
- All health checks are independent; a failure on one instance should not abort the others.
- `allSettled` is the correct choice over `Promise.all` because we want every check to run to completion and we update the widget incrementally.

### 4. `rows[index]` is always in bounds
- `rows` and `promises` are built from the same `Object.entries(freshConfig.instances)` array in the same synchronous block (lines ~356–360, ~402–418).
- The `index` passed to `.map()` is identical in both loops, so each async closure writes to the same index it was assigned.

### 5. Widget update logic is safe in the JS concurrency model
- `rows` is shared mutable state, but JavaScript is single-threaded.
- Each resolution performs its mutations (`rows[index].reachable = ...`) and then calls `updateWidget()` synchronously within the same microtask.
- `renderWidget()` reads the entire `rows` array synchronously. There is no interleaving that could produce a torn read.
- `setWidget` is a full state replace, so multiple overlapping `updateWidget()` calls are harmless; the last one wins with the most current data.

### 6. Formatting conversion is clean
- The entire file was converted from 2-space to 4-space indent consistently.
- No mixed indentation artifacts.
- Unused import `dirname` was correctly removed (it was not referenced anywhere in the old version).
- Import order was alphabetized, which is a minor cleanup win.

---

## Fixed

None applied (review-only).

---

## Blocker

None.

---

## Note

### N1: `discoverModelSpecs` priority shift when `healthResponse` is provided
**Location:** `discoverModelSpecs`, lines 186–210 (shortcut layer).

The in-file comment says discovery is layered as `/v1/models → /health → instances.yaml → fallback`. In the old code, Layer 1 (`/v1/models`) had highest priority. The new shortcut layer is placed **before** Layer 1, so a pre-fetched `/health` response now takes precedence over a fresh `/v1/models` call.

This only affects the `/event-horizon` command (provider registration still calls `discoverModelSpecs` without `healthResponse`). In practice, the data sources are the same proxy, so the difference is negligible. However, it is a documented-priority inversion introduced by the optimization. If `/v1/models` ever carries more authoritative `model_info` than `/health`, the command will no longer see it.

**Risk:** Low — both endpoints come from the same proxy instance.

### N2: Widget can be left in "checking..." state if the handler throws before `Promise.allSettled`
**Location:** `handler`, lines 340–425.

The handler clears stale widgets on entry (`setWidget(..., undefined)`), shows the initial "checking..." widget, then fires parallel checks. If an exception is thrown synchronously during `ensureConfig()`, `renderWidget()`, or during the creation of the `promises` array, the handler exits without reaching `await Promise.allSettled(promises)`. The widget would remain showing "checking..." indefinitely.

The commit message explicitly states this is intentional: *"No auto-clear timer to avoid racing with a rapid re-invocation."* The next `/event-horizon` invocation will clear it. This is a reasonable trade-off, but worth acknowledging as a UX edge case.

**Risk:** Low — `ensureConfig()` and `renderWidget()` are unlikely to throw in practice; the user can re-run the command.

### N3: Timeout reduction for `checkInstance` is a behavior change
**Location:** `checkInstance`, line ~256.

The timeout was reduced from `5000` ms to `3000` ms. On slow or high-latency networks, instances that previously registered as reachable may now show as offline.

**Risk:** Low-to-moderate — depends on the user's network conditions. The change is intentional per the commit message, but it is a user-visible behavior change, not just a refactor.

### N4: Empty `instances` would crash `renderWidget` via `Math.max(...[])`
**Location:** `renderWidget`, line ~372.

If a user edits `instances.yaml` to contain `instances: {}`, `rows` becomes empty and `Math.max(...[])` returns `-Infinity`, causing `" ".repeat(-Infinity)` to throw `RangeError`.

This bug **pre-existed** in the old synchronous notify-based code (`Math.max(...results.map(...))`). It was not introduced by this commit.

**Risk:** Low — `ensureConfig()` auto-creates a default `local` instance when the file is missing, so the empty-instances scenario requires deliberate user editing.

### N5: `discoverModelSpecs` may skip the fallback `/health` fetch if a stale `healthResponse` is provided
**Location:** `discoverModelSpecs`, lines 224–225.

The fallback Layer 2 is gated by `if (!healthResponse)`. If `checkInstance` returns a `healthResponse` object that lacks `target_model` or `model_info` (e.g., the proxy responded but those fields were absent), the shortcut check fails, but the fallback `/health` fetch is still skipped because `healthResponse` is truthy.

In the current sequential code this is unlikely to matter (the second `/health` call would return the same data milliseconds later). If the calls were ever restructured to run concurrently or with delays, this could hide transient proxy warmup states.

**Risk:** Very low — requires proxy state changes within a single event-loop turn.

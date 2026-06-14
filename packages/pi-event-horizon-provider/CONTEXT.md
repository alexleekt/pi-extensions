# Context: pi-event-horizon-provider

## Glossary

### Event Horizon Instance

A configured LiteLLM proxy endpoint defined in `~/.pi/agent/config/event-horizon/instances.yaml`. Each instance has a `url` and optional model-spec overrides. At runtime, each instance is registered as a Pi provider under the namespace `event-horizon/<name>`.

### Singularity

The canonical model ID exposed by every Event Horizon instance. The proxy rewrites all incoming model names to the configured upstream target, so Pi only needs to know `singularity` regardless of what actual model is running behind the proxy.

### Health Check

An HTTP GET to `<instance_url>/health`. The response includes:
- `status` — overall proxy health
- `target_model` — the upstream model the proxy is routing to
- `model_info` — optional enriched specs (context_window, max_tokens, supports_vision, cost)
- `litellm` — LiteLLM subsystem status

A health check with `litellm.status === "ok"` means the instance is **reachable and usable**.

### Model Discovery

The layered process that determines model specs (context window, max tokens, input types, cost) for an instance:

1. **LiteLLM `/v1/models`** — read `model_info` for the `singularity` entry
2. **Event Horizon `/health` enrichment** — use `target_model` + `model_info` from the health response
3. **`instances.yaml` overrides** — per-instance manual overrides
4. **Static fallback** — safe conservative defaults when the proxy is unreachable

### Provider Registration

The Pi API call `pi.registerProvider("event-horizon/<name>", { ... })` that makes the instance available in Pi's model selector. Registered at extension startup and whenever config changes.

### Status Widget

The non-blocking widget above the editor shown by the `/event-horizon` command. Displays the instance list immediately; updates each row as its `/health` check resolves.

**Dismissal contract.** The widget is dismissed on the earliest of:
- **`agent_start`** — the next agent turn begins (the user has moved on to a new task). This is the canonical "the user is done looking" signal.
- **`input`** — the user starts typing a prompt. Defense-in-depth fallback.
- **A new `/event-horizon` invocation** — the new run clears the previous widget, aborts any in-flight checks via `AbortController`, and re-renders from scratch.

The widget is *not* auto-cleared on a timer. It persists until one of the above signals fires, so the user has time to read the final row state without the layout being yanked away mid-read. The per-instance promise chain checks `signal.aborted` between every `await` to suppress stale `updateWidget()` callbacks from a cancelled invocation. The status-mode handler is wrapped in `try/finally` to guarantee a final `updateWidget()` flush, which preserves partial-state diagnostic info when some rows are still "checking" at end.

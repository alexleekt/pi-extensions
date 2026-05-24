# Flight Rules for pi-event-horizon-provider

## Purpose

Pi extension that registers Event Horizon proxy instances as LLM providers.

## Architecture

- `index.ts` — Single entry point. Async factory reads config, registers providers, sets up command.
- `package.json` — Declares extension for pi package system.

## Key Invariants

- **Provider namespace is `event-horizon/<name>`** — Never change without a migration plan.
- **Model ID is always `singularity`** — The proxy rewrites all model names to the target.
- **API is `openai-completions`** — The proxy handles translation to the actual provider.
- **Config auto-creates with default `local` instance** — Never fail if config is missing.
- **Model discovery is layered (C → A → B → overrides → static)** — See README for the five layers.

## File Responsibilities

| File           | Role                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| `index.ts`     | Extension factory, config I/O, model discovery, health checks, command handler |
| `package.json` | Package metadata, pi extension declaration                                     |

## Common Pitfalls

- **Uses `yaml` package for config parsing** — Declared in `package.json` dependencies. The `yaml` package handles full YAML spec including quoted strings, anchors, and comments.
- **Config path is `~/.pi/agent/config/event-horizon/instances.yaml`** — Hardcoded. Changing it is a breaking change.
- **`apiKey: "EVENTHORIZON_API_KEY"` is intentionally a dummy** — The proxy redshifts auth; pi needs a non-empty env var name. The actual value is irrelevant.
- **LiteLLM `/v1/models` may not expose `model_info`** — This is expected. The fallback chain handles it.
- **Set `EVENTHORIZON_DEBUG=1` for registration logging** — `console.log` is gated behind this env var to keep TUI clean.

## Testing

Install the extension, ensure Event Horizon is running, then:

```
/event-horizon
```

Should show all instances as online with their target models.

Switch model:

```
/model event-horizon/local
```

## Code Style

- TypeScript, 2-space indentation
- Use `node:` prefix for built-in imports
- `async` factory function for one-time startup
- Prefer `fetch()` with `AbortSignal.timeout()` for HTTP
- Return `source` from discovery functions for debugging

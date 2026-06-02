# Flight Rules for pi-event-horizon-provider

## Overview

Pi extension that registers Event Horizon proxy instances as LLM providers. Built in TypeScript for the Pi coding agent harness. The proxy rewrites all model names to a configured target, so this provider acts as a transparent pass-through with health checks and model discovery.

## Purpose

Registers Event Horizon proxy instances as LLM providers within Pi.

## Architecture

- `index.ts` — Single entry point. Async factory reads config, registers providers, sets up command.
- `package.json` — Declares extension for pi package system.

## Key Invariants

- **Provider namespace is `event-horizon/<name>`** — Changing this requires a migration plan.
- **Model ID is always `singularity`** — The proxy rewrites all model names to the target.
- **API defaults to `openai-completions`** — Per-instance override via `api` field in `instances.yaml`. The proxy handles translation to the actual provider.
- **Config auto-creates with default `local` instance** — Must always succeed even when config is missing.
- **Model discovery is layered (pre-fetched health → LiteLLM /v1/models → /health → instances.yaml overrides → static fallback)** — See README for the four layers.

## File Responsibilities

| File           | Role                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| `index.ts`     | Extension factory, config I/O, model discovery, health checks, command handler |
| `package.json` | Package metadata, pi extension declaration                                     |

## Common Pitfalls

- **Uses `yaml` package for config parsing** — Declared in `package.json` dependencies. The `yaml` package handles full YAML spec including quoted strings, anchors, and comments.
- **Config path is `~/.pi/agent/config/event-horizon/instances.yaml`** — Hardcoded. Changing it is a breaking change.
- **Dummy API key placeholder** — The config field `apiKey` holds a non-empty dummy string. The proxy handles all actual authentication; the Pi provider system only requires the field to be populated, not the value itself.
- **LiteLLM `/v1/models` may not expose `model_info`** — This is expected. The fallback chain handles it.
- **Set `EVENTHORIZON_DEBUG=1` for registration logging** — Console output is gated behind this env var to keep TUI clean.

## Validation

After modifying any `AGENT.md`, `AGENTS.md`, `claude.md`, or `SKILL.md` file, **always run agnix validation**:

```bash
agnix validate .
```

agnix validates: Skills • MCP servers • Hooks • Memory • Plugins across Claude Code, Cursor, Codex, and Kiro targets.

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
- Prefer `fetch()` with an `AbortSignal` timeout for HTTP
- Return `source` from discovery functions for debugging

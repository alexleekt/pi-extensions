# Changelog

## 0.2.1 (2026-06-13)

- Fix status widget persisting across agent turns. The widget now dismisses
  on the next `agent_start` event so it steps out of the way when the user
  moves on to a new task. A new `agent_start` listener at extension load
  handles this; the existing `input` listener remains as a defense-in-depth
  fallback. See [ADR 0002](./docs/adr/0002-widget-dismissal-lifecycle.md).
- Re-running `/event-horizon` while checks are in flight now cancels the
  prior run's per-instance promises via an `AbortController`, so stale row
  state from the old run cannot overwrite the new run's in-flight updates.
- Status-mode handler wrapped in `try/finally` to guarantee a final
  `updateWidget()` flush, preserving partial-state diagnostic info on error
  paths.
- Widget key extracted to a `STATUS_WIDGET_KEY` constant.

## 0.2.0 (2026-05-30)

- Per-instance API format selection (`api` field in `instances.yaml`)
- Supports `openai-completions`, `anthropic-messages`, and `openai-responses`
- Status command shows API format per instance
- Toggle API format via `/event-horizon <instance> <anthropic|openai|responses>`
- Fix double `/v1/` path when using `anthropic-messages` or `openai-responses`

## 0.1.0 (2026-05-24)

- Initial release
- Provider registration with `event-horizon/<name>` namespace
- Layered model discovery (LiteLLM model_info → /health enrichment → hardcoded registry → instances.yaml overrides → static defaults)
- `/event-horizon` dynamic status command
- Auto-create default config
- Multi-instance support with config in `~/.pi/agent/config/event-horizon/`

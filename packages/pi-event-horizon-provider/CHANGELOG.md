# Changelog

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

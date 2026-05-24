# Changelog

## 0.1.0 (2026-05-24)

- Initial release
- Provider registration with `event-horizon/<name>` namespace
- Layered model discovery (LiteLLM model_info → /health enrichment → hardcoded registry → instances.yaml overrides → static defaults)
- `/event-horizon` dynamic status command
- Auto-create default config
- Multi-instance support with config in `~/.pi/agent/config/event-horizon/`

# pi-event-horizon-provider Roadmap

## v0.1.0

- [x] Provider registration with `event-horizon/<name>` namespace
- [x] Layered model discovery (LiteLLM model_info → /health enrichment → hardcoded registry → instances.yaml overrides → static defaults)
- [x] `/event-horizon` status command
- [x] Auto-create default config
- [x] Health check with reachability reporting

## v0.2.0 — Additional API Formats (Current)

- [x] Support `anthropic-messages` API option per instance
- [x] Support `openai-responses` API option per instance
- [x] Allow user to select preferred API format in `instances.yaml`

## v0.3.0 — LLM-Callable Tools

- [ ] `list_event_horizon_instances` tool
- [ ] `switch_event_horizon_instance` tool
- [ ] `get_event_horizon_status` tool

## v0.4.0 — Model Discovery Enhancement

- [ ] Fetch full model list from LiteLLM admin endpoints (requires master key)
- [ ] Auto-populate `model_info` in Event Horizon `config.yaml`
- [ ] Cache discovered specs with TTL to avoid repeated probing

## Not Planned

- **OAuth support** — The proxy handles auth via `PROVIDER_API_KEY` in `.env`. OAuth would add complexity without clear value.

## Future Structure

- **Migrate to `~/git/pi-extensions` mono-repo** — When this extension stabilizes, move it to a shared extensions monorepo alongside other pi provider packages.

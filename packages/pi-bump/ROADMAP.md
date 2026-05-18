# Roadmap

`pi-bump` is feature-complete. All items below are shipped.

- [x] Double-Enter detection on empty editor
- [x] Guard against firing while streaming or when messages are pending
- [x] Invisible continuation via hidden `customType` message
- [x] Context guard to strip leaked markers before LLM calls
- [x] `/continue` command with `status` and `help` subcommands

## Maybe

- [ ] **Configurable double-tap threshold** — expose `THRESHOLD_MS` as a user setting (e.g. per-session config or env var)

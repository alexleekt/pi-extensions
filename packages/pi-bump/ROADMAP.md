# Roadmap

## Current

- [x] Double-Enter detection on empty editor
- [x] Guard against firing while streaming or when messages are pending
- [x] Basic integration test coverage

## Near-term

- [ ] **Configurable nudge message** — replace hard-coded `"Bump"` (see `DEFAULT_NUDGE_MESSAGE` TODO in `index.ts`)
- [ ] **Configurable double-tap threshold** — expose `THRESHOLD_MS` as user setting
- [ ] **Support `deliverAs: "followUp"`** — allow bumps to queue even when the agent is streaming, instead of being silently ignored

## Future

- [ ] Optional status-bar flash feedback when a bump is sent
- [ ] Per-session configuration via JSON config file
- [ ] Expand test coverage: threshold expiration, pending-messages guard, session re-initialization

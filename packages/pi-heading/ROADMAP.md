# ROADMAP — @alexleekt/pi-heading

## Completed foundations

- [x] One-line rendering through Pi's native `setWorkingMessage()` surface
- [x] Native Pi indicator only; no extension-owned animation timer
- [x] Goal and achievement summarization without blocking the agent loop
- [x] Finalization through `agent_settled`, after retries and queued follow-ups
- [x] Intermediate-turn detection through `TurnEndEvent.toolResults`
- [x] Abort-aware summary calls through `ctx.signal`
- [x] Branch replay on session start and `/tree` navigation
- [x] Event-bus exposure for passive extension composition
- [x] Packed-install import smoke coverage

## Short-term

### Model validation on startup

- [ ] Check whether the configured heading model has usable authentication on `session_start`
- [ ] Show one warning with a `/heading-model` recovery path
- [ ] Cache validation for the active session

### Cheaper model selector

- [ ] Offer an optional fast/cheap filter in `/heading-model`
- [ ] Keep the full model list available
- [ ] Remember the last working override

## Medium-term

### Prompt editing

- [ ] Add a command to inspect current prompt overrides
- [ ] Support editing through `ctx.ui.editor()`
- [ ] Validate required placeholders before saving
- [ ] Preview output against the last message without mutating the active prompt

### Topic history

- [ ] Preserve topic transitions as optional metadata
- [ ] Expose drift diagnostics without adding another UI row
- [ ] Keep the default event channel latest-state only

## Explicitly deferred

- **Automatic session naming:** `pi.setSessionName()` is useful, but silently overriding `/name` would blur responsibility between heading state and user-owned session metadata.
- **Custom working indicators:** `setWorkingIndicator()` would duplicate Pi's native loader and violate the working-message-only contract.
- **Project trust hooks:** pi-heading reads user-level configuration, not project-local executable resources, so `project_trust` is not applicable.
- **Multi-line or bordered UI:** intentionally outside this package's one-line, no-ghosting scope.

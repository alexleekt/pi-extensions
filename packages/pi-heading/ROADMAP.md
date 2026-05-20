# ROADMAP — @alexleekt/pi-heading

## Short-term

### Model validation on startup
- [ ] Check if the configured heading model (override or session model) has a valid API key on `session_start`
- [ ] If not, show a one-time warning via `ctx.ui.notify()` suggesting `/heading-model` to pick a working model
- [ ] Cache the validation result for the session to avoid repeated checks

### Cheaper model selector
- [ ] `/heading-model` should filter to fast/cheap models by default (flash/mini/haiku/turbo)
- [ ] Show estimated cost per 1K tokens alongside each model option
- [ ] Remember the last working cheap model per-provider and suggest it

## Medium-term

### Prompt improvement loop
- [ ] `/heading-prompt` command to show current topic and goal prompts side-by-side
- [ ] Allow user to edit prompts inline via `ctx.ui.editor()`
- [ ] A/B preview: show what the *current* prompt would produce vs. a *draft* prompt on the last message
- [ ] Prompt lint: warn if user prompt is missing `{message}` placeholder or has contradictory instructions

### Topic evolution tracking
- [ ] Store topic history per branch (not just latest)
- [ ] Show drift indicator when topic changes significantly between turns
- [ ] Optional: graph of topic transitions over the conversation

## Long-term

### Semantic topic clustering
- [ ] Embed topics (lightweight local model) to group related sessions
- [ ] Suggest "similar past sessions" when starting a new branch
- [ ] Cross-session goal search: "find all sessions where I worked on Docker"

### Multi-line widget mode (opt-in)
- [ ] A `pi-heading-experimental` variant that renders 2-3 lines with soft borders using full-width background color (no corner chars)
- [ ] This avoids the ghosting issue by eliminating border fragments while allowing more density
- [ ] Only enable if terminal reports support for `CSI 2026` synchronized output

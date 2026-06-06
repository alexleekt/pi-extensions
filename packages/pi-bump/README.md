# @alexleekt/pi-bump

[![npm](https://img.shields.io/npm/v/@alexleekt/pi-bump)](https://www.npmjs.com/package/@alexleekt/pi-bump)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Invisible continuation for the Pi agent.**

Resume the agentic loop without sending the LLM a single token.

## Usage

### Double-tap Enter (quickest)

1. Make sure the chat editor is **empty**
2. Press **Enter twice** within ~300 ms
3. The agent continues — the LLM sees nothing

### `/continue` command

| Command | What it does |
|---------|-------------|
| `/continue` | Resume the loop invisibly (or visibly if escalated) |
| `/continue status` | Show if the agent is idle, busy, or escalated |
| `/continue help` | Show available commands |

Both methods only fire when the agent is idle and no messages are pending.

## How it works

**Default (invisible)**: A hidden `customType` message is sent with `display: false`. The `context` handler replaces it with `"Continue"` before the LLM sees it. The LLM receives a clean semantic nudge and the chat stays uncluttered.

**Escalated (visible)**: When loop detection notices the last two assistant responses had identical tool calls (or exact text duplicates), the *next* continue sends a real visible user message like `"Keep going"` or `"Press on"` — stronger signal, same goal.

A `context` event handler proactively removes any leaked invisible markers as insurance. Real user input always resets escalation state.

## Installation

```bash
npm install -g @alexleekt/pi-bump
```

Pi auto-discovers globally installed `pi-package` extensions.

Or copy `index.ts` into `.pi/extensions/` (project) or `~/.pi/agent/extensions/` (global).

## Debug mode

```bash
BUMP_DEBUG=1 pi
```

Then toggle per-session debugging with `/bump-debug-keypresses`:

- **Enter** — triggers invisible continue + shows timing
- **Backspace, Delete** — shows timing only
- **Ctrl+Enter, Alt+Enter** — also monitored

Debug mode resets when the session ends. Only available when `BUMP_DEBUG=1` is set.

> **Note:** Debug mode monitors 5 keys (enter, backspace, delete, ctrl+enter, alt+enter). In normal mode, only Enter is monitored for performance. The other keys are only checked when debug mode is active for that session.

## Performance

pi-bump is designed to stay out of the way:

- **Minimal keystroke overhead** — In normal mode, only `Enter` is matched against incoming keystrokes. No `matchesKey()` calls for backspace, delete, or modifier keys unless debug mode is active.
- **Zero-allocation context guard** — The `context` handler scans for invisible markers with `.some()` before allocating. In typical conversations (no invisible messages), no array is created.
- **Synchronous state reset** — The `input` handler resets escalation state immediately (no microtask deferral), preventing false loop detection.

## Hybrid Escalation Strategy (v0.3.1+)

`pi-bump` uses a two-tier strategy to keep the agent moving without polluting the chat:

1. **Invisible tier** (default) — sends a hidden `customType` message (`display: false`). The `context` handler replaces it with `"Continue"` for the LLM. Chat stays clean.
2. **Visible tier** (escalation) — when loop detection sees identical tool calls (or exact text duplicates) across the last two assistant responses, the *next* continue sends a real visible user message with a randomized nudge like `"Continue"`, `"Resume"`, or `"Keep going"`.
3. **Auto-reset** — a non-loop assistant response or real user input resets back to the invisible tier.

The visible tier only triggers when the invisible tier isn't breaking the loop — so most continues stay silent and seamless.

## Acknowledgments

The invisible continuation technique was adapted from [pi-invisible-continue](https://github.com/monotykamary/pi-invisible-continue) by Tom X Nguyen.

## License

MIT

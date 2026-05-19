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
| `/continue` | Resume the loop invisibly |
| `/continue status` | Show if the agent is idle or busy |
| `/continue help` | Show available commands |

Both methods only fire when the agent is idle and no messages are pending.

## How it works

- A hidden `customType` message is sent with `display: false`
- Pi's default `convertToLlm` strips custom messages before they reach the LLM
- The LLM receives unchanged context and loops naturally
- A `context` event handler also proactively removes any leaked markers as insurance

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

## Experimental: Hybrid Continue (v0.3.0+)

`pi-bump` now uses a hybrid strategy to avoid repeat loops:

1. **Invisible trigger** — sends a hidden `customType` message (`display: false`) so nothing appears in chat
2. **LLM continue signal** — replaces the hidden marker with `"Continue"` in the LLM context, giving the model a clear semantic nudge without polluting the conversation
3. **Duplicate detection** — tracks the last two assistant responses; blocks further continues if they're identical (indicates a loop)
4. **Auto-reset** — real user input resets the duplicate detection window

If you hit a blocked continue, type something new and try again.

> ⚠️ This is experimental. Feedback welcome via GitHub issues.

## Acknowledgments

The invisible continuation technique was adapted from [pi-invisible-continue](https://github.com/monotykamary/pi-invisible-continue) by Tom X Nguyen.

## License

MIT

# @alexleekt/pi-bump

[![npm](https://img.shields.io/npm/v/@alexleekt/pi-bump)](https://www.npmjs.com/package/@alexleekt/pi-bump)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**The quickest way to say "keep going".**

> Double-tap **Enter** on an empty chat input to nudge the Pi agent with a randomized **nudge** from a curated set of 16 variations.

## Why

The Pi agent sometimes pauses waiting for more input. Instead of typing "continue" or "go on", just double-tap **Enter** on an empty editor — zero typing, zero context switch.

## Usage

1. Install the extension.
2. In Pi's interactive mode, make sure the editor is empty.
3. Press **Enter twice** within ~300 ms to send a nudge.

The extension only fires when the agent is idle and no messages are queued.

## Installation

### Via npm

```bash
npm install -g @alexleekt/pi-bump
```

Pi auto-discovers globally installed `pi-package` extensions.

### Manual

Copy `index.ts` into your project's `.pi/extensions/` folder, or into `~/.pi/agent/extensions/` for global use.

## License

MIT

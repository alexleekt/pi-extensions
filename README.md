# @alexleekt/pi-bump

Double-Enter on an empty chat input to nudge the Pi agent with a **"Bump"** message.

## Usage

1. Install the extension via npm or copy it to your extensions directory.
2. In Pi's interactive mode, make sure the editor is empty.
3. Press **Enter twice** within ~300 ms.
4. The extension sends "Bump" as a user message.

> The extension only fires when the agent is **idle** (not streaming) and there are no **pending messages** already queued. It is silently ignored while the agent is generating a response or if messages are already queued.

## Installation

### Via npm (global)

```bash
npm install -g @alexleekt/pi-bump
```

Pi auto-discovers globally installed `pi-package` extensions.

### Manual (project-local)

Copy `index.ts` into your project's `.pi/extensions/` folder, or into `~/.pi/agent/extensions/` for global availability.

## How it works

- Hooks into raw terminal input via `ctx.ui.onTerminalInput()`.
- Detects two consecutive `\r` / `\n` keystrokes while the editor is empty.
- Swallows the first empty Enter to arm the detector.
- On the second empty Enter within the threshold, calls `pi.sendUserMessage("Bump")`.
- Only fires when the agent is idle and no messages are already queued.

## Future improvements

- Configurable nudge message (not hard-coded to "Bump").
- Configurable double-tap threshold.
- Optional delivery mode when streaming (`steer` vs `followUp`).

## License

MIT

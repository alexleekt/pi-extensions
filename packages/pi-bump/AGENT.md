# AGENT.md — @alexleekt/pi-bump

## Purpose

A Pi extension that sends a **"Bump"** message when the user presses **Enter twice** on an empty chat input.

## Architecture

- **Entry point**: `index.ts` exports a default factory receiving `ExtensionAPI`.
- **Lifecycle**: Attaches a terminal listener on `session_start` and removes it on `session_shutdown`.
- **Detection**:
  1. Listen via `ctx.ui.onTerminalInput()`.
  2. Ignore non-Enter keystrokes.
  3. Ignore when the editor has text.
  4. First empty Enter arms a 300 ms timer (keystroke passes through).
  5. Second empty Enter within threshold fires `pi.sendUserMessage("Bump")` and consumes the keystroke.
  6. Only fire when the agent is idle with no pending messages.

## Key APIs

- `ExtensionAPI.on("session_start" | "session_shutdown", handler)`
- `ExtensionUIContext.onTerminalInput(handler)` → unsubscribe
- `ExtensionUIContext.getEditorText()`
- `ExtensionAPI.sendUserMessage(content)`
- `ExtensionContext.isIdle()` / `hasPendingMessages()`

## Testing

- **Type-check**: `npm run check`
- **Integration**: `node test-integration.mjs`
- **Manual**: Install, open Pi interactive mode, and double-tap Enter on an empty editor.

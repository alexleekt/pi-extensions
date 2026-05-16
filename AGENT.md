# AGENT.md — @alexleekt/pi-bump

## Purpose
This Pi extension lets users nudge the agent by pressing **Enter twice** on an empty chat input. It sends a configurable "Continue" message automatically.

## Architecture
- **Entry point**: `index.ts` exports a default factory function receiving `ExtensionAPI`.
- **Lifecycle**: Registers `session_start` to attach a raw terminal input listener via `ctx.ui.onTerminalInput()`. Cleans up on `session_shutdown`.
- **Detection logic**:
  1. Intercept `\r` or `\n` keystrokes.
  2. Check `ctx.ui.getEditorText()` — if non-empty, ignore (let normal submit happen).
  3. If empty, track timestamp. First empty Enter is consumed to arm the detector.
  4. Second empty Enter within `THRESHOLD_MS` (default 300 ms) triggers `pi.sendUserMessage(DEFAULT_NUDGE_MESSAGE)`.
  5. Only fires when `ctx.isIdle()` (agent not streaming).
  6. Shows a brief status flash via `ctx.ui.setStatus()` for 800 ms.

## Key APIs
- `ExtensionAPI.on("session_start", handler)` / `on("session_shutdown", handler)`
- `ExtensionUIContext.onTerminalInput(handler)` → returns unsubscribe
- `ExtensionUIContext.getEditorText()` / `setEditorText()`
- `ExtensionAPI.sendUserMessage(content, options?)`
- `ExtensionContext.isIdle()`

## Testing
- **Type-check**: `npm run check` (runs `tsc --noEmit`)
- **Integration test**: `node test-integration.mjs` — mocks ExtensionAPI/Context and verifies all code paths.
- **Manual E2E**: Install via `pi install ./pi-bump`, open Pi interactive mode, ensure editor is empty, double-tap Enter within 300 ms, observe "Continue" user message and status flash.

## Future work
- Make `DEFAULT_NUDGE_MESSAGE` configurable via a JSON config file.
- Make `THRESHOLD_MS` configurable.
- Consider supporting `deliverAs: "followUp"` when the agent is streaming (currently ignored).

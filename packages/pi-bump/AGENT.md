---
parent: ../../AGENT.md
---

# AGENT.md — @alexleekt/pi-bump

## Monorepo Context

This package lives inside the `pi-extensions` monorepo. See [`../../AGENT.md`](../../AGENT.md) for monorepo-wide conventions (shared tooling, just commands, release process, CI setup).

## Purpose

A Pi extension that sends a **"Bump"** message when the user presses **Enter twice** on an empty chat input.

Includes a **debug mode** (`/bump-debug-keypresses`) to test double-tap detection on non-printing keys.

## Architecture

- **Entry point**: `index.ts` exports a default factory receiving `ExtensionAPI`.
- **Lifecycle**: Attaches a terminal listener on `session_start` and removes it on `session_shutdown`.
- **Detection**:
  1. Listen via `ctx.ui.onTerminalInput()`.
  2. Match keystrokes against a curated key list using `matchesKey()` from `@earendil-works/pi-tui`.
  3. Ignore when the editor has text (Enter only).
  4. First keypress arms a 300 ms timer (keystroke passes through).
  5. Second matching keypress within threshold triggers action and consumes the keystroke.
  6. Enter double-tap: sends a nudge when idle with no pending messages.
  7. Non-Enter double-tap: shows a debug notification only when `/debug-bump` is toggled ON for the current session.

## Key APIs

- `ExtensionAPI.on("session_start" | "session_shutdown", handler)`
- `ExtensionAPI.registerCommand(name, options)`
- `ExtensionUIContext.onTerminalInput(handler)` → unsubscribe
- `ExtensionUIContext.getEditorText()`
- `ExtensionUIContext.notify(message, type)`
- `ExtensionAPI.sendUserMessage(content)`
- `ExtensionContext.isIdle()` / `hasPendingMessages()`
- `ExtensionContext.sessionManager.getSessionId()`
- `@earendil-works/pi-tui`: `matchesKey(data, keyId)` / `Key.*`

## Debug Mode

- **Command**: `/debug-bump` — toggles per-session debug mode.
- **Monitored keys**: `enter`, `backspace`, `delete`, `ctrl+enter`, `alt+enter`.
  - All chosen because they do **not** insert characters into the editor.
- **Behavior**:
  - Enter: still sends nudge, plus shows `"Double-tap: enter (245ms)"` notification.
  - Other keys: shows `"Double-tap: <key> (<duration>ms)"` notification, no nudge.
- **Scope**: Per-session, non-persistent.

## Testing

- **Type-check**: `npm run check`
- **Integration**: `node test-integration.mjs`
- **Manual**: Install, open Pi interactive mode, and double-tap Enter on an empty editor.

## Releasing

Use scoped package tags (not bare `vX.Y.Z`):

```bash
just release 0.2.4   # creates @alexleekt/pi-bump@0.2.4
```

This matches the monorepo convention used for all packages in this repo.

---
parent: ../../AGENT.md
---

# AGENT.md — @alexleekt/pi-bump

## Monorepo Context

This package lives inside the `pi-extensions` monorepo. See [`../../AGENT.md`](../../AGENT.md) for monorepo-wide conventions (shared tooling, just commands, release process, CI setup).

## Purpose

A Pi extension that **invisibly continues** the agentic loop.

- **Double-tap Enter** on an empty chat input → triggers invisible continue
- **`/continue`** command → triggers invisible continue manually
- **`/continue status`** → shows agent idle/pending state
- **`/continue help`** → shows available subcommands
- **`/bump-debug-keypresses`** → toggles per-session double-tap debug mode

The LLM never sees a new message. A hidden `customType` message with `display: false` is sent, stripped by Pi's default `convertToLlm` filters before reaching the model.

## Architecture

- **Entry point**: `index.ts` exports a default factory receiving `ExtensionAPI`.
- **Commands**: `/continue` (with `status`/`help` subcommands), `/bump-debug-keypresses` (debug-only).
- **Invisible trigger**: `sendMessage({ customType: "__invisible_continue", content: "", display: false, details: {} }, { triggerTurn: true })`.
- **Context guard**: `pi.on("context")` proactively strips any leaked continue markers before each LLM call.
- **Double-tap detection**: Attaches a terminal listener on `session_start`. Uses `matchesKey()` from `@earendil-works/pi-tui` to identify keystrokes. Enter on an empty editor arms a 300 ms timer; a second Enter within the threshold fires invisible continue. Non-Enter keys only trigger debug notifications when debug mode is active.

## Key APIs

- `ExtensionAPI.on("session_start" | "session_shutdown", handler)`
- `ExtensionAPI.registerCommand(name, options)`
- `ExtensionAPI.sendMessage(content, options)` — with `customType`, `display: false`, `triggerTurn: true`
- `ExtensionAPI.on("context", handler)` — strip custom messages from context
- `ExtensionUIContext.onTerminalInput(handler)` → unsubscribe
- `ExtensionUIContext.getEditorText()`
- `ExtensionUIContext.notify(message, type)`
- `ExtensionContext.isIdle()` / `hasPendingMessages()`
- `ExtensionContext.sessionManager.getSessionId()`
- `@earendil-works/pi-tui`: `matchesKey(data, keyId)` / `Key.*`

## Debug Mode

- **Command**: `/bump-debug-keypresses` toggles per-session debug mode (only when `BUMP_DEBUG=1` env is set).
- **Monitored keys**: `enter`, `backspace`, `delete`, `ctrl+enter`, `alt+enter` — all non-printing.
- **Behavior**: Shows `"Double-tap: <key> (<duration>ms)"` notification on each double-tap. Enter still triggers invisible continue; other keys do not.
- **Scope**: Per-session, non-persistent.

## Testing

- **Type-check**: `npm run check`
- **Manual**: Install, open Pi interactive mode, and double-tap Enter on an empty editor. The agent should continue without the LLM seeing a new message.

## Releasing

Use scoped package tags (not bare `vX.Y.Z`):

```bash
just release 0.3.0   # creates @alexleekt/pi-bump@0.3.0
```

This matches the monorepo convention used for all packages in this repo.

## Acknowledgments

The invisible continuation technique was adapted from [pi-invisible-continue](https://github.com/monotykamary/pi-invisible-continue) by Tom X Nguyen.

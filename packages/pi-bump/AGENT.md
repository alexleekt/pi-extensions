---
parent: ../../AGENT.md
---

# AGENT.md — @alexleekt/pi-bump

> Behavioral rules for AI agents working on this codebase.

## Monorepo Context

This package lives inside the `pi-extensions` monorepo. See [`../../AGENT.md`](../../AGENT.md) for monorepo-wide conventions.

## Invariants (Never Break These)

1. **Invisible trigger contract** — The `customType` message must always use `display: false` and `triggerTurn: true`. The LLM must never see the continue marker.
2. **Context guard** — The `pi.on("context")` handler must proactively strip any leaked continue markers before each LLM call.
3. **Double-tap threshold** — The 300 ms timer between Enter keystrokes must not be changed without testing across terminal emulators.
4. **Idle-only trigger** — Continue only fires when `ExtensionContext.isIdle()` is true and no messages are pending.

## Critical Rules

### Debug mode safety
Debug mode (`BUMP_DEBUG=1`) is per-session and non-persistent. Never log user keystrokes outside of the debug notification. The monitored keys (`enter`, `backspace`, `delete`, `ctrl+enter`, `alt+enter`) are all non-printing — no text content is captured.

### No blocking in key handler
The terminal input handler must return immediately. Never await slow operations inside the keystroke callback.

## Extension-Specific Rules

- **Indentation:** 2 spaces (TypeScript)
- **Imports:** Use `.js` extensions on relative imports (NodeNext module resolution)
- **Peer deps:** `@earendil-works/pi-coding-agent` only

## Decision Making

| Scenario | Action |
|----------|--------|
| Changing the invisible trigger payload shape | Ask first — this affects how Pi's core filters it |
| Modifying double-tap timing or key detection | Ask first |
| Adding new commands | Proceed, follow existing registration pattern |
| Bug fixes with clear solution | Proceed |

## Deferred Work (Do Not Touch Without Discussion)

- Hybrid continue strategy (replacing hidden marker with "Continue" in LLM context)
- Duplicate response detection and auto-reset logic

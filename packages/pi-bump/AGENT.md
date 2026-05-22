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
5. **Escalation contract** — When `needsEscalation` is set for a session, the next continue must send a visible user message via `pi.sendUserMessage()`, not an invisible custom message.
6. **Loop detection accuracy** — Tool-call fingerprint comparison must include function name and arguments. Do not include tool call IDs (they vary per turn).

## Critical Rules

### Debug mode safety
Debug mode (`BUMP_DEBUG=1`) is per-session and non-persistent. Never log user keystrokes outside of the debug notification. The monitored keys (`enter`, `backspace`, `delete`, `ctrl+enter`, `alt+enter`) are all non-printing — no text content is captured.

In normal mode, only `enter` is monitored. The other keys are only checked when debug mode is explicitly toggled for that session via `/bump-debug-keypresses`.

### No blocking in key handler
The terminal input handler must return immediately. Never await slow operations inside the keystroke callback.

### Fast-path ordering
The handler checks `editorText` before `matchesKey()`. When the user is typing, only Enter needs matching. Do not reorder these checks — doing so would restore the 5x `matchesKey()` overhead on every keystroke.

### Conditional key monitoring
`DEBUG_KEYS` contains 5 keys, but in normal mode only `[Key.enter]` is checked. The full list is only used when `debugSessions.has(sessionId)` is true. Any change to this logic must preserve the 80% per-keystroke savings in normal mode.

### Escalation reset
`needsEscalation` must be cleared on:
- Any non-loop assistant response (detected in `message_end`)
- Real user input (detected in `input` event with `source === "interactive"`)

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
| Changing loop detection heuristics | Ask first — affects when users see visible vs invisible continues |
| Changing nudge message pool | Proceed |
| Bug fixes with clear solution | Proceed |

## Architecture

### Hybrid Escalation Strategy (v0.3.1+)

pi-bump uses a two-tier continue strategy:

1. **Invisible tier** (default): Sends `customType` message with `display: false`. The `context` handler replaces the marker with `"Continue"` for the LLM. This is silent and clean.

2. **Visible tier** (escalation): When loop detection fires (same tool calls or exact text duplicate across the last two assistant responses), the *next* continue sends a real visible user message with a randomized nudge from `NUDGE_MESSAGES`. This gives the LLM genuine user input to break the pattern.

**State per session:**
- `lastFingerprints: [prev, last]` — tracks the last two assistant response fingerprints
- `needsEscalation: Set<string>` — whether the next continue should use visible tier

**Reset triggers:**
- Non-loop assistant response → clear escalation
- Real user input → clear escalation and reset fingerprint history

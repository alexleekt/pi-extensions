---
parent: ../../AGENT.md
---

# AGENT.md — @alexleekt/pi-herdr-tab-sync

> Behavioral rules for AI agents working on this codebase.

## Monorepo Context

This package lives inside the `pi-extensions` monorepo. See [`../../AGENT.md`](../../AGENT.md) for monorepo-wide conventions.

> This file is authoritative for this repository. If it conflicts with general agent guidelines, this file wins.

## Invariants (Never Break These)

1. **Only rename when session name exists** — if the session has no name, do nothing.
2. **Only activate inside herdr** — guard all herdr calls with `HERDR_ENV=1`.
3. **No blocking on failure** — herdr CLI failures are silent (notification only, no crash).

## Extension-Specific Rules

- **Indentation:** 2 spaces (TypeScript)
- **Imports:** Use `.js` extensions on relative imports (NodeNext module resolution)
- **Peer deps:** `@earendil-works/pi-coding-agent` only.

## Decision Making

| Scenario | Action |
|----------|--------|
| Adding new herdr IPC | Ask first |
| Modifying herdr detection logic | Proceed, but keep `HERDR_ENV=1` guard |
| Bug fixes with clear solution | Proceed |

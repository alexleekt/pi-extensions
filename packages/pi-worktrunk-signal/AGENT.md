---
parent: ../../AGENT.md
---

# AGENT.md — @alexleekt/pi-worktrunk-signal

> Behavioral rules for AI agents working on this codebase.

## Monorepo Context

This package lives inside the `pi-extensions` monorepo. See [`../../AGENT.md`](../../AGENT.md) for monorepo-wide conventions.

## Invariants (Never Break These)

1. **Never block the agent** — All worktrunk operations (`wt list`, `wt switch`, etc.) must use async child process spawning. Never `await` a `wt` command in a message handler.
2. **Only inside herdr** — Activity tracking only activates when `HERDR_ENV=1` is set. Check `process.env.HERDR_ENV` before any UI modifications.
3. **Marker cleanup** — `session_shutdown` must clear all `worktrunk.state.*.marker` git config entries to avoid stale markers in `wt list`.
4. **Path resolution** — Use `git worktree list --porcelain` to resolve actual paths, never assume a directory naming convention.

## Critical Rules

### Worktree operations
All `wt` CLI calls go through `execFile` or `exec` with proper error handling. The extension must degrade gracefully if `wt` is not installed.

### Subagent spawning
`spawn_worktree_agent` uses `pi --mode json -p --no-session` for headless execution. Always pass the worktree path as `--cwd`.

## Extension-Specific Rules

- **Indentation:** 2 spaces (TypeScript)
- **Imports:** Use `.js` extensions on relative imports (NodeNext module resolution)
- **Console output:** Use `[pi-worktrunk-signal]` prefix for all `console.error`/`console.warn`
- **Peer deps:** `@earendil-works/pi-coding-agent` only.
- **`noEmit` tsconfig** — Pi loads `.ts` files directly. Do NOT add `outDir` or `declaration` settings.

## Decision Making

| Scenario | Action |
|----------|--------|
| Adding new `wt` commands | Verify `wt` is installed first, degrade gracefully |
| Modifying activity markers | Ensure `session_shutdown` cleans them up |
| Bug fixes with clear solution | Proceed |

## Deferred Work (Do Not Touch Without Discussion)

- Native worktrunk API integration (if `wt` exposes one)
- Custom `worktree-path` template validation

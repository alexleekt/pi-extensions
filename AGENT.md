# AGENT.md — @alexleekt/pi-extensions

> Behavioral rules for AI agents working on this monorepo.

## Communication Style

- Be direct and to the point
- Ask clarifying questions when requirements are unclear
- Flag security implications immediately

## Working in This Monorepo

- Keep changes scoped to the package you're working on
- Never mix unrelated changes in a single commit
- Use isolated worktrees (e.g. `git worktree`) when available to prevent clobbering work on other packages

## Before Committing

1. Run `npm run typecheck` in the affected package
2. Run `just lint` or `npx @biomejs/biome check` for the affected files
3. Run `npm test` if the package has tests
4. Review `PUBLISH.md` before any release-related changes

## Design Journals (Required)

After any significant session (>30 min or touching architecture), write a design journal:

```
packages/<pkg>/docs/session/YYYY-MM-DD-title.md
```

**Trigger:** Write one when you made a non-obvious decision, found a surprising bug, or reversed a prior decision.

**Template:** See `docs/session/JOURNAL_CONVENTION.md`. At minimum include:
1. Session goal
2. Original problem
3. Key decisions with options considered
4. Bugs found — symptom, root cause, fix, prevention
5. Documentation updated

**Relationship to other docs:**
- **ADR** (`docs/adr/`) — one hard decision → one ADR
- **CONTEXT.md** — glossary terms resolved during the session
- **AGENT.md** — invariants that changed
- **Memex card** — atomic insight saved via `memex_retro`

Use the quest log as the journal outline. Use vent entries for the "prevention" section.

## Code Conventions

- TypeScript only — Pi loads `.ts` files directly
- Use `.js` extensions on relative imports (NodeNext module resolution)
- All packages extend `packages/tsconfig.base.json`
- Every package has a `typecheck` script (`tsc --noEmit`)
- `check` as backward-compatible alias where needed

## Decision Making

| Scenario | Action |
|----------|--------|
| Adding new dependencies | Ask first |
| Changing shared tooling (root biome, tsconfig, justfile) | Ask first |
| Modifying core detection logic in any package | Ask first |
| Refactoring type guards or tests | Proceed, then verify tests pass |
| Adding tests | Proceed |
| Documentation updates | Proceed |
| Bug fixes with clear solution | Proceed |

## Invariants (Never Break These)

- No per-package `package-lock.json` — root lockfile only
- No per-package `.github/workflows/` — CI lives at root
- Release tags: always scoped (`@alexleekt/pi-bump@0.3.0`), never bare `v0.3.0`
- Biome checks extension code only — webviews have their own build toolchains and are excluded

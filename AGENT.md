# AGENT.md — @alexleekt/pi-extensions

> Behavioral rules for AI agents working on this monorepo.

## Monorepo Structure

```
packages/
  tsconfig.base.json      ← shared TypeScript config
  pi-ask-user-glimpse/
  pi-bump/
  pi-pkg-guard/
  pi-shared/
.github/workflows/        ← CI lives at root only
justfile                  ← typecheck, lint, fmt, publish, release
biome.json                ← root formatter/linter config
package-lock.json         ← single workspace lockfile
```

## Shared Tooling

- **TypeScript**: All packages extend `packages/tsconfig.base.json`
- **Biome**: Root formatter/linter (`just fmt`, `just lint`)
- **just**: Task runner — see `just --list`
- **npm workspaces**: `npm ci` at root installs all deps

## Adding a New Package

1. Create `packages/new-package/`
2. Extend `../tsconfig.base.json`
3. Add `typecheck: tsc --noEmit` script
4. Add to CI matrix in `.github/workflows/ci.yml`
5. Update root `README.md` package table

## Lint Scope

Biome checks **extension code only**. Webviews (React/Vite) have their own build toolchains and are excluded.

```bash
# pi-ask-user-glimpse example:
npx @biomejs/biome check \
  packages/pi-ask-user-glimpse/index.ts \
  packages/pi-ask-user-glimpse/tool \
  packages/pi-ask-user-glimpse/shared \
  packages/pi-ask-user-glimpse/fallback \
  packages/pi-ask-user-glimpse/types \
  packages/pi-ask-user-glimpse/scripts
```

## Releasing

```bash
just release pi-bump 0.3.0
```

This bumps version, commits, tags (`@alexleekt/pi-bump@0.3.0`), and pushes — triggering `.github/workflows/publish.yml`.

**Before releasing, consult [`PUBLISH.md`](./PUBLISH.md)** for the pre-release checklist and troubleshooting. Key checks:
- `repository.url` is set in `package.json` (required for Trusted Publishing provenance)
- Package is already bootstrapped on npm if it's a first-time publish
- `npm run typecheck` passes

## Pi Extension Development Setup

For local dev loading into the Pi agent:

```bash
# Symlink extensions
ln -s ~/git/pi-extensions/packages/pi-bump ~/.pi/agent/extensions/pi-bump
ln -s ~/git/pi-extensions/packages/pi-shared ~/.pi/agent/extensions/pi-shared

# Single node_modules link — workspace resolves all deps
ln -s ~/git/pi-extensions/node_modules ~/.pi/agent/node_modules
```

**Critical:** After moving or retargeting extension symlinks, clear jiti's file cache or stale compiled paths will persist:

```bash
rm -rf /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/.cache/jiti/
```

## Design Journals (Required)

After any significant session (>30 min or touching architecture), write a design journal in the affected package:

```
packages/<pkg>/docs/session/YYYY-MM-DD-title.md
```

**Trigger:** Write one when you made a non-obvious decision, found a surprising bug, or reversed a prior decision.

**Template:** See `docs/session/JOURNAL_CONVENTION.md` for the full template. At minimum include:
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

## Conventions

- Every package has a `typecheck` script (`tsc --noEmit`)
- `check` as backward-compatible alias where needed
- No per-package `package-lock.json` — root lockfile only
- No per-package `.github/workflows/` — CI lives at root
- Release tags: always scoped (`@alexleekt/pi-bump@0.3.0`), never bare `v0.3.0`

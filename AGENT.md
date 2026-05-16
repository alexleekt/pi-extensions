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

## Conventions

- Every package has a `typecheck` script (`tsc --noEmit`)
- `check` as backward-compatible alias where needed
- No per-package `package-lock.json` — root lockfile only
- No per-package `.github/workflows/` — CI lives at root
- Release tags: always scoped (`@alexleekt/pi-bump@0.3.0`), never bare `v0.3.0`

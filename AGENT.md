# AGENT.md — @alexleekt/pi-extensions

> Monorepo-specific guidelines for AI agents working on this codebase.
> This file is authoritative for this repository.

## What This Project Is

A **monorepo** for Pi coding agent extensions, managed as npm workspaces.
All packages are published under the `@alexleekt/` npm scope.

| Package | Description |
|---|---|
| `pi-ask-user-glimpse` | Rich WebView dialogs via glimpseui |
| `pi-bump` | Double-Enter nudge with randomized prompts |
| `pi-pkg-guard` | Package management guard for Pi extensions |

## Monorepo Structure

```
packages/
  tsconfig.base.json      ← shared TypeScript config
  pi-ask-user-glimpse/
  pi-bump/
  pi-pkg-guard/
.github/workflows/ci.yml  ← matrix CI for all packages
justfile                  ← typecheck, lint, fmt, publish
biome.json                ← root formatter/linter config
package-lock.json         ← single workspace lockfile
```

## Shared Tooling

- **TypeScript**: All packages extend `packages/tsconfig.base.json`
- **Biome**: Root formatter/linter (4-space indent, double quotes)
- **just**: Task runner (`just typecheck`, `just lint`, `just fmt`)
- **npm workspaces**: `npm ci` at root installs all deps

## Adding a New Package

1. Create `packages/new-package/`
2. Extend `../tsconfig.base.json`
3. Add `typecheck: tsc --noEmit` script
4. Add to CI matrix in `.github/workflows/ci.yml`
5. Update root `README.md` table

## CI Behavior

- Runs on every push/PR to `main`
- Matrix checks all packages independently
- `fail-fast: false` — all packages checked even if one fails
- Steps per package: Biome → typecheck → tests → dry-run publish

## Lint Scope

Biome checks **extension code only**. Webviews (React/Vite) and screenshots are excluded because they have their own toolchains.

```bash
# For pi-ask-user-glimpse:
npx @biomejs/biome check \
  packages/pi-ask-user-glimpse/index.ts \
  packages/pi-ask-user-glimpse/tool \
  packages/pi-ask-user-glimpse/shared \
  packages/pi-ask-user-glimpse/fallback \
  packages/pi-ask-user-glimpse/types \
  packages/pi-ask-user-glimpse/scripts
```

## Publishing

```bash
just publish pi-bump    # cd packages/pi-bump && npm publish --access public
```

Packages use npm provenance (GitHub Actions OIDC → npm). Manual publish is a fallback.

## Key Conventions

- `typecheck` script in every package (`tsc --noEmit`)
- `check` as backward-compatible alias where needed
- No per-package `package-lock.json` — workspace uses root lockfile
- No per-package `.github/workflows/` — CI lives at root

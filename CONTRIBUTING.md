# Contributing to pi-extensions

This monorepo contains multiple independently-published Pi extensions under the `@alexleekt/` scope.

## Monorepo Structure

```
packages/
  tsconfig.base.json      ← shared TypeScript config
  pi-ask-user-glimpse/
  pi-bump/
  pi-pkg-guard/
  pi-heading/
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

## Releasing

```bash
just release pi-bump 0.3.0
```

This bumps version, commits, tags (`@alexleekt/pi-bump@0.3.0`), and pushes — triggering `.github/workflows/publish.yml`.

**Before releasing, consult [`PUBLISH.md`](./PUBLISH.md)** for the pre-release checklist and troubleshooting. Key checks:
- `repository.url` is set in `package.json` (required for Trusted Publishing provenance)
- Package is already bootstrapped on npm if it's a first-time publish
- `npm run typecheck` passes

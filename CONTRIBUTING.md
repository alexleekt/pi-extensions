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
# Fix formatting first, then verify the same scope used by CI:
npx @biomejs/biome check --write \
  packages/pi-ask-user-glimpse/index.ts \
  packages/pi-ask-user-glimpse/tool \
  packages/pi-ask-user-glimpse/shared \
  packages/pi-ask-user-glimpse/constants \
  packages/pi-ask-user-glimpse/types
npx @biomejs/biome check \
  packages/pi-ask-user-glimpse/index.ts \
  packages/pi-ask-user-glimpse/tool \
  packages/pi-ask-user-glimpse/shared \
  packages/pi-ask-user-glimpse/constants \
  packages/pi-ask-user-glimpse/types

# Or run the complete package CI recipe:
just ci-package pi-ask-user-glimpse
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

Follow the **`publish` skill** at `.agents/skills/publish/SKILL.md`.

Releases run through a release branch and pull request — `main` is protected, and the publish tag is pushed only after the release PR merges. The legacy `just release` and `just publish` recipes have been removed; the `publish` skill owns the flow.

Key checks:
- `repository.url` is set in `package.json` (required for Trusted Publishing provenance)
- Package is already bootstrapped on npm if it's a first-time publish
- `npm run typecheck` passes

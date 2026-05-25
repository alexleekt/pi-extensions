# @alexleekt/pi-extension-reloader

[![npm](https://img.shields.io/npm/v/@alexleekt/pi-extension-reloader)](https://www.npmjs.com/package/@alexleekt/pi-extension-reloader)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**One-command rebuild and reload for Pi extensions.**

When you edit a Pi extension, `/reload` doesn't always pick up changes — especially with symlinked monorepos or webview bundles. This extension automates the full cycle.

## Usage

```bash
/rebuild-extension <name>
```

| Argument | Description |
|----------|-------------|
| `<name>` | Extension name as it appears in `~/.pi/agent/extensions/` |

### Example

```bash
/rebuild-extension pi-ask-user-glimpse
```

## When you need this

### 1. Symlinked monorepo (essential)

If your extension is a symlink into a git worktree or monorepo, `/reload` is **broken by design**:

- Jiti caches compiled `.mjs` files keyed by the *resolved realpath*
- When you switch worktrees, the realpath changes
- Jiti creates a *new* cache file but the *old* one still matches the symlink name
- `/reload` loads the stale cache file

This extension surgically deletes only the matching cache files, not the whole cache.

### 2. Webview extensions (very useful)

Extensions with a React/Vite webview need `npm run build` to produce `dist/index.html`. `/reload` only re-registers the server-side code — it doesn't rebuild the bundle. This extension runs the build step for you.

### 3. Pure TypeScript extensions (convenience)

For simple `.ts` extensions that aren't symlinked, `/reload` usually works because jiti checks file modification times. If it doesn't, setting `JITI_FS_CACHE=false` is the cleaner upstream fix. This extension is optional here — it's sugar, not necessity.

## What happens

1. **Jiti cache cleared** — Finds and deletes compiled `.mjs` files matching the extension
2. **Cache verified** — Confirms `.mjs` files were actually deleted; warns if any remain
3. **Webview rebuilt** — Runs `npm run build` (or `npm run build:webview`) if the extension has one
4. **Runtime reloaded** — `ctx.reload()` re-registers everything with fresh code

### Safety guards

- **Npm packages are protected** — Extensions under `node_modules/` only get their cache cleared; no rebuild is attempted (npm manages those)
- **Path traversal blocked** — Arguments with `..`, `/`, or `\` are rejected unless they're absolute paths

## Installation

```bash
npm install -g @alexleekt/pi-extension-reloader
```

Pi auto-discovers globally installed `pi-package` extensions.

> **Zero build step for this extension.** `pi-extension-reloader` ships as a single TypeScript file. Pi compiles it on-the-fly — no `npm run build`, no bundle, no `dist/` directory.

## Why a full reload is needed

Jiti caches compiled `.mjs` files on disk. Clearing those files removes the on-disk cache, but Pi also holds the extension's commands and state in memory. The `ctx.reload()` call at the end re-registers everything so your new code is actually active.

## Alternatives and upstream context

This extension exists because Pi's extension loader disables jiti's in-memory cache (`moduleCache: false`) but leaves disk cache (`fsCache`) at its default `true`. Jiti supports `rebuildFsCache: true` which checks file mtimes and rebuilds stale cache automatically — Pi doesn't use it.

**If you want to avoid this extension entirely:**

```bash
# Disable jiti disk cache globally (slower reloads, always fresh)
export JITI_FS_CACHE=false
pi
```

This eliminates the stale-cache problem for all extensions, at the cost of recompiling from source on every load.

**Honest assessment:**
- The cache-clearing half of this extension becomes unnecessary if Pi adds `rebuildFsCache: true` (or `fsCache: false` for local extensions) in its loader
- The webview rebuild half remains useful — `/reload` will never run `npm run build` for you

## License

MIT

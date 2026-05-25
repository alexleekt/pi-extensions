# @alexleekt/pi-extension-reloader

[![npm](https://img.shields.io/npm/v/@alexleekt/pi-extension-reloader)](https://www.npmjs.com/package/@alexleekt/pi-extension-reloader)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**One-command rebuild and reload for Pi extensions.**

When you edit a Pi extension, the changes aren't live immediately — jiti caches the compiled code, and webview bundles must be rebuilt. This extension automates the full cycle in a single command.

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

### What happens

1. **Jiti cache cleared** — Removes cached compiled files so Pi picks up your latest TypeScript
2. **Webview rebuilt** — Runs `npm run build` (or `npm run build:webview`) in the extension directory
3. **Runtime reloaded** — Pi re-scans and re-registers the extension with fresh code

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

Jiti (Pi's TypeScript loader) caches compiled `.mjs` files on disk. Clearing those files removes the on-disk cache, but Pi also holds the extension's commands and state in memory. The `ctx.reload()` call at the end re-registers everything so your new code is actually active.

## License

MIT

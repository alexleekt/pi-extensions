# @alexleekt/pi-extension-reloader

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**One-command rebuild, cache-clear, and reload for local Pi extensions.**

When you're developing a Pi extension, changing the source isn't enough — jiti's filesystem cache keeps the old compiled `.mjs` around, and the webview bundle in `dist/` might be stale. This extension automates the full cycle: rebuild the webview, purge jiti cache, and reload the Pi runtime.

## Usage

```bash
/rebuild-extension <name>
```

| Argument | Description |
|----------|-------------|
| `<name>` | Bare extension name (e.g. `pi-ask-user-glimpse`) or absolute path |

### Example

```bash
/rebuild-extension pi-ask-user-glimpse
```

### What happens

1. **Jiti cache cleared** — Finds and deletes cached `.mjs` files for the extension
2. **Webview rebuilt** — Runs `npm run build` (or `npm run build:webview`) in the extension directory
3. **Status persisted** — Journal entries record the rebuild start/completion so you can see it after reload
4. **Pi runtime reloaded** — `ctx.reload()` brings in the fresh code

### Safety guards

- **Npm packages are protected** — If the extension lives under `node_modules/`, only the jiti cache is cleared; no rebuild is attempted
- **Path traversal rejected** — Arguments with `..`, `/`, or `\` are blocked unless they're absolute paths
- **Local-only rebuilds** — Extensions outside `~/.pi/agent/extensions/` are still treated as local and rebuilt

## Jiti cache discovery

The extension automatically discovers jiti's cache directory by checking, in order:

1. `JITI_FS_CACHE` environment variable
2. Common temp paths: `os.tmpdir()/jiti`, `/tmp/jiti`
3. Deep scan of `os.tmpdir()` for directories containing `.mjs` files with `jitiImport` signatures

If no cache directory is found, the rebuild still proceeds (webview + reload), but you'll see a warning.

## Installation

```bash
npm install -g @alexleekt/pi-extension-reloader
```

Pi auto-discovers globally installed `pi-package` extensions.

Or symlink into `~/.pi/agent/extensions/`:

```bash
cd ~/.pi/agent/extensions
ln -s /path/to/pi-extension-reloader .
```

## License

MIT

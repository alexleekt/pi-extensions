# Research: jiti Cache Invalidation & pi-extension-reloader Necessity

## Summary

`pi-extension-reloader` is justified for specific cases (symlinked monorepos, webview extensions) but is largely sugar for pure TypeScript extensions where `JITI_FS_CACHE=false` or upstream fixes would be cleaner. The extension is a workaround for gaps in Pi/jiti's development workflow, not a permanent solution.

## Findings

1. **Jiti has `JITI_FS_CACHE=false`** — Disables filesystem cache entirely, forcing recompile on every load. Pi doesn't expose this as a user option. Setting it eliminates stale cache issues but adds ~1-2s per reload for 5-10 extensions.

2. **Jiti's cache key uses resolved realpath** — When symlinks change targets (git worktree switch), the old cache file is orphaned. Jiti creates a new cache file for the new path but `/reload` may still match the old filename. This is the core bug that makes `/reload` broken for symlinked monorepos.

3. **Pi's `/reload` only re-scans extensions** — Per Pi docs, `/reload` "re-scans extensions directories and re-registers them." It does NOT interact with jiti's cache layer. Pi treats jiti as opaque.

4. **No jiti CLI for cache management** — The jiti repository provides no `jiti cache clean` or invalidation tooling. Cache eviction is entirely manual.

5. **The symlink case is uniquely problematic** — Normal file edits work with jiti's mtime checks. Symlink target changes break the cache key mechanism in a way jiti cannot detect.

## Council Consensus

| Scenario | Need for extension | Reason |
|---|---|---|
| Symlinked monorepo / git worktree | **Essential** | `/reload` loads stale cache by design |
| Webview extensions | **Very useful** | `/reload` doesn't rebuild `dist/` bundles |
| Pure TS extensions (normal path) | **Marginal** | `JITI_FS_CACHE=false` is cleaner upstream |

## Recommendation

- **Keep the extension** — the symlinked monorepo case is genuinely broken without it
- **Document the symlink case prominently** — it's the real differentiator
- **Consider upstream lobbying** — ask Pi to support `JITI_FS_CACHE=false` in dev mode or expose cache clearing
- **Don't oversell** — for non-webview, non-symlink extensions, it's convenience, not necessity

# Progress

## Status
In Progress

## Tasks
- [x] Research jiti cache invalidation mechanisms
- [x] Council review: Is pi-extension-reloader necessary?
- [x] Write findings to research.md
- [x] Update README with honest value proposition

## Files Changed
- packages/pi-extension-reloader/council-reviews.md (new)
- packages/pi-extension-reloader/README.md (updated)
- packages/pi-ask-user-glimpse/research.md (new)

## Notes
Council consensus: Extension is essential for symlinked monorepos, very useful for webview extensions, marginal for pure TS extensions. The symlink case is the real differentiator because jiti's cache key uses resolved realpath, which breaks on worktree switches.
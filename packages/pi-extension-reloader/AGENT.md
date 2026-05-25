# Agent Guidelines

## Communication Style
- Be direct and to the point
- This is a developer-tool extension; accuracy matters more than polish
- **Be honest about limitations:** this extension is a workaround for a Pi core gap, not a permanent solution

## Code Conventions
- Follow existing patterns in `pi-bump` and `pi-ask-user-glimpse` for consistency
- Use TypeScript with strict types; avoid `any`
- Prefer synchronous file operations where async adds no value

## Workflow Rules
- Run `npm run check` (tsc --noEmit) before committing
- Keep the extension as a single `index.ts` file — no build step needed
- Test `/rebuild-extension` against a real symlinked extension before declaring done

## Troubleshooting: "Changes still not showing after reload"

The most common false-positive is **not** a jiti cache issue — it's the working tree branch.

### Diagnostic order (always run in this sequence)

1. **Branch check** — In the extension's source repo, run `git branch --show-current`. If the working tree is on `main` but your changes are on a feature branch, `/rebuild-extension` correctly rebuilds the `main` version. Switch branches first.
2. **Commit check** — `git log --oneline -5` confirms the expected commits are actually present on the current branch.
3. **Cache check** — Only after verifying the source is correct, check whether jiti compiled the new code: `find /tmp -name "*<extension-name>*" -newer <source-file>`.

### Prevention: git worktree for parallel branches

If you maintain multiple extension branches (e.g., `main` + `feature/async-widget`), use `git worktree add` instead of switching branches on the same working tree:

```bash
git worktree add ../pi-extension-feature-branch feature/async-widget
# Point the symlink at the worktree, or keep a second extensions dir entry
```

This eliminates the "which branch is checked out?" ambiguity entirely.

## Tool Usage
- Use `Edit` tool for precise changes to `index.ts`
- Use `Bash` for file operations and verification
- Keep jiti cache discovery logic robust — it runs on every user machine with different temp paths

## Critical Context: Why This Extension Exists

**The upstream problem:** Pi's `loader.js:265` creates jiti with `moduleCache: false` but leaves `fsCache: true` (default). This means:
- `/reload` re-registers extensions in memory
- But jiti still serves stale compiled `.mjs` from disk cache
- Result: you edit code, `/reload`, see no changes

**Jiti has the fix:** `rebuildFsCache: true` checks file mtime and rebuilds stale cache automatically. Pi doesn't use it.

**What this extension does:**
1. Discovers jiti cache directory (macOS randomizes `/var/folders/.../`)
2. Surgically deletes `.mjs` files matching the extension name
3. Runs `npm run build` for webview extensions ( `/reload` never does this )
4. Persists rebuild status via journal entries (survives `ctx.reload()`)
5. Calls `ctx.reload()`

**Honest assessment:**
- For symlinked monorepos: **Essential** — jiti hashes resolved realpath, not symlink path. Worktree switches orphan cache files.
- For webview extensions: **Very useful** — `/reload` doesn't rebuild `dist/index.html`
- For pure TS extensions: **Sugar** — `JITI_FS_CACHE=false` or a shell alias gets 90% there

**When this becomes dead code:** If Pi adds `rebuildFsCache: true` (or `fsCache: false` for local extensions) in `loader.js`, the cache-clearing half of this extension is no longer needed. The webview rebuild half remains useful.

See memex cards: [[pi-loader-jiti-fscache-gap]], [[jiti-symlink-realpath-cache-bug]], [[pi-extension-reloader-temporary-workaround]]

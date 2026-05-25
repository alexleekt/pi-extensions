# Council Review: Is `pi-extension-reloader` Necessary?

## Specialist 1: Upstream Fixability Analyst

**Question:** Could Pi or jiti make this extension unnecessary?

**Findings:**

1. **Jiti has `JITI_FS_CACHE=false`** — Setting this env var disables the filesystem cache entirely. This would eliminate the stale cache problem but at a cost: every reload recompiles all extensions from scratch. For 5-10 extensions, this adds ~1-2s to `/reload`. Pi doesn't expose this as a user-facing option.

2. **Jiti's cache key includes file path** — The `.mjs` filename embeds a hash of the source path. When symlinks change targets (worktree switch), the old cache file has a *different* path hash than the new one. Jiti doesn't detect this as stale — it just sees a cache miss and creates a *new* file. The *old* file sits there forever. This is not a jiti bug; it's a cache eviction policy choice.

3. **Pi's `/reload` only re-scans extensions** — Looking at Pi's docs: `/reload` "re-scans extensions directories and re-registers them." It does NOT clear jiti cache. Pi treats jiti as an opaque layer.

4. **No jiti CLI tool exists** — The jiti repo has no `jiti cache clean` or `jiti invalidate` command. Cache management is entirely manual.

**Verdict:** This is a solvable upstream problem *in theory*. Pi could:
- Set `JITI_FS_CACHE=false` during development mode
- Add a `pi cache clear` command
- Watch extension directories and auto-invalidate on file changes

But none of these exist. **The extension is a workaround for a gap, not a permanent solution.**

---

## Specialist 2: Developer Experience Realist

**Question:** How much pain does this actually save?

**User journey without the extension:**
1. Edit `index.ts` → Save
2. Run `/reload` → "Why didn't my change show?"
3. Realize jiti cache → `rm -rf /var/folders/.../jiti/*` (but where is it?)
4. Run `/reload` again → Works
5. Edit webview CSS → Save
6. Run `/reload` → CSS still old
7. Realize `dist/index.html` is stale → `cd webview && npm run build`
8. Run `/reload` again → Works

**User journey with the extension:**
1. Edit → Save
2. `/rebuild-extension pi-ask-user-glimpse` → Done

**Verdict:** The pain is real and frequent. For webview extensions, it's a 3-step manual process every time. For pure TS extensions, it's at least a 2-step process (find cache + reload). The extension collapses this to one command with zero cognitive load.

---

## Specialist 3: Monorepo Symlink Specialist

**Question:** Is the symlinked workspace case uniquely problematic?

**Yes. The symlink case is the actual bug that motivated this extension.**

Normal workflow: Edit → Save → `/reload` → Works. Jiti's mtime check handles this.

Symlinked monorepo workflow: Edit in `/Users/alex/git/pi-extensions/packages/pi-ask-user-glimpse/` → Save → `/reload` → Stale code. Why?

- The symlink at `~/.pi/agent/extensions/pi-ask-user-glimpse` points to the worktree
- Jiti caches the *resolved realpath* in the `.mjs` filename
- When you switch worktrees (git worktree), the resolved path changes
- Jiti creates a NEW cache file for the new path
- The OLD cache file still matches the symlink name and gets loaded on `/reload`

**This is NOT a normal mtime staleness issue.** It's a symlink target change that jiti's cache key cannot detect because the key is based on the resolved realpath, not the symlink path.

**Verdict:** The symlink worktree case is a genuine edge case that `/reload` alone cannot solve. The extension's surgical cache deletion is the only fix short of `rm -rf` carpet-bombing.

---

## Council Consensus

**Agree: The extension is justified, but for specific reasons:**

1. **For symlinked monorepo development** — Essential. `/reload` is broken by design for this case.
2. **For webview extensions** — Very useful. Saves 2-3 manual steps per iteration.
3. **For pure TS extensions in normal mode** — Marginal. `JITI_FS_CACHE=false` would be better upstream.

**Recommendation:** Keep the extension, but:
- Document the symlink case prominently (it's the real differentiator)
- Consider upstream lobbying: ask Pi to set `JITI_FS_CACHE=false` in dev mode, or expose cache clearing
- Don't oversell it — for non-webview, non-symlink extensions, it's convenience, not necessity

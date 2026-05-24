# Scout Report: `/rebuild-extension` Command Analysis

**Scope:** Static analysis of `pi-extension-reloader` and `pi-ask-user-glimpse` compatibility.
**Date:** 2026-05-24

---

## ✅ Verified Behaviors

| # | Check | Result |
|---|-------|--------|
| 1 | `pi-extension-reloader` installed in `~/.pi/agent/extensions/` | **Yes** — `index.ts` present (9,352 bytes) |
| 2 | `pi-ask-user-glimpse` is a symlink under `~/.pi/agent/extensions/` | **Yes** → `~/git/pi-extensions/packages/pi-ask-user-glimpse` |
| 3 | `/rebuild-extension pi-ask-user-glimpse` resolves path correctly | **Yes** — `resolveExtensionPath` finds `index.ts` inside the directory |
| 4 | Local-vs-npm guard recognizes it as local | **Yes** — `isLocalExtension()` returns `true` because the path is a symlink under `~/.pi/agent/extensions/` |
| 5 | `build:webview` script exists and runs successfully | **Yes** — `npm run build:webview` resolves `wireit` via workspace root `.bin` and executes correctly |
| 6 | User is told to run `/reload` afterward | **Yes** — unconditional `ctx.ui.notify` at end of handler |

---

## 🐛 Bugs

### 1. Dash-stripping heuristic breaks cache matching
**File:** `pi-extension-reloader/index.ts:106-110`

```ts
entry.toLowerCase().includes(extName.toLowerCase().replace(/-/g, ""))
```

For `pi-ask-user-glimpse`, the search term becomes `piaskuserglimpse` (no dashes). Jiti cache filenames, however, often embed the *original* path (with dashes). A filename like `…pi-ask-user-glimpse…` will **fail** `.includes("piaskuserglimpse")`, causing the fast filename heuristic to miss the cache file. The slower content heuristic (first 2 KB scan) may catch it, but this is unreliable and race-prone.

**Fix:** Normalize dashes out of *both* the filename and the search term, or keep dashes in the search term.

---

### 2. `isLocalExtension` treats non-symlink directories as "npm"
**File:** `pi-extension-reloader/index.ts:128-142`

If a developer clones an extension repo **directly** into `~/.pi/agent/extensions/pi-foo/` (real directory, not symlink), `statSync(extPath).isSymbolicLink()` returns `false`. The function falls through and returns `false`, so the extension is treated as an npm package and rebuild is skipped. The UI message *"X is an npm package — skipping rebuild"* is misleading.

**Fix:** Consider any directory (symlink or not) under `~/.pi/agent/extensions/` as local, or change the message to "not a symlink".

---

## ⚠️ Missing Error Handling / UX Issues

### 3. Silent failure when jiti cache directory is not found
**File:** `pi-extension-reloader/index.ts:187-198`

If `findJitiCacheDir()` returns `undefined` (none of the 3 candidates exist and the deep tmpdir scan fails), the command still prints:
> "Now run /reload to reload extensions in the current session."

But no cache was cleared, so `/reload` will just reload the *same* cached code. The user gets no warning that the cache directory could not be discovered.

**Fix:** Notify a `warning` when `cacheDir` is undefined, telling the user to restart Pi or clear caches manually.

---

### 4. Build errors may swallow useful stderr
**File:** `pi-extension-reloader/index.ts:165-179`

`rebuildWebview` uses `exec` (not `execFile`) with the default 1 MB buffer. A verbose Vite/Tailwind build can overflow this buffer and crash the agent command with a generic `stdout maxBuffer length exceeded` error. Additionally, `err.message` may not contain the full `stderr` from `npm run`, making it hard for the user to see *why* the build failed.

**Fix:** Use `spawn` with `{ stdio: 'inherit' }` or `exec` with an explicit large `maxBuffer`, and surface `stderr` explicitly in the error notification.

---

### 5. Missing `node_modules` guard before build
If a user symlinks an extension but never ran `npm install` (or the workspace root `node_modules` is missing), `npm run build:webview` fails with a generic "command not found" or ENOENT. The error is caught and shown, but a pre-flight check for `node_modules/.bin/` (or just `npm` availability) would give a clearer message.

---

### 6. `cmd` variable is parsed but never used
**File:** `pi-extension-reloader/index.ts:153-154`

```ts
const cmd = pkg.scripts?.["build:webview"] ?? pkg.scripts?.build;
```

`cmd` is assigned, but the actual command string is recomputed inline in the ternary on line 169. Minor code smell; not a bug, but confusing for future maintainers.

---

## 🎯 Edge Cases Reviewed

| Scenario | Handled? | Notes |
|----------|----------|-------|
| Extension has **no `package.json`** | ✅ Yes | Warns and skips rebuild |
| Extension has **no build script** | ✅ Yes | Warns and skips rebuild |
| Extension has **no `webview/`** | ⚠️ Partial | Will attempt `npm run build` / `build:webview`; npm failure caught |
| Extension is **npm-installed** (in `node_modules`) | ✅ Yes | Skips rebuild, clears cache, reminds `/reload` |
| Extension path is **absolute** (`/some/path`) | ✅ Yes | Treated as local, rebuild attempted |
| Extension is **a file** (`*.ts`) | ⚠️ Edge | `resolveExtensionPath` accepts `.ts` files, but `rebuildWebview` expects a directory with `package.json`; will skip rebuild. UX is acceptable. |
| **Jiti cache not found** | ❌ No | Silent; see Issue #3 above |
| **Cache file deletion fails** | ✅ Yes | `try/catch` ignores per-file errors; continues |

---

## 🔧 Recommendations (Priority Order)

1. **Fix dash-stripping bug** in `findExtensionCacheFiles` — highest impact on correctness.
2. **Warn when jiti cache directory cannot be found** — prevents false confidence after `/reload`.
3. **Broaden `isLocalExtension`** to treat any directory under `~/.pi/agent/extensions/` as local, not just symlinks.
4. **Improve build error UX** — show `stderr` and use a larger buffer or `spawn`.
5. **Remove or use the `cmd` variable** to avoid dead-code confusion.

---

## Bottom Line

`/rebuild-extension pi-ask-user-glimpse` **will work** for the current symlink-based setup. The happy path is solid. However, the jiti-cache filename heuristic has a real bug that could leave stale caches uncleared, and the silent missing-cache-dir case means `/reload` may appear to do nothing.

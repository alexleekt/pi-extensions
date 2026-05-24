# Council Review Report — pi-ask-user-glimpse

**Reviewed:** package.json (wireit + prepare), .gitignore, pi-extension-reloader/index.ts  
**Date:** 2026-05-24  
**Verdict:** **NO — requires fixes before merge**

---

## 1. Wireit "files" Inputs — Incomplete

### Finding A: `build:css` misses Tailwind content sources
The `build:css` task tracks only `.css` files, `tailwind.config.js`, and `index.html`:

```json
"files": [
  "./webview/src/**/*.css",
  "./webview/tailwind.config.js",
  "./webview/index.html"
]
```

But the Tailwind command scans `src/**/*.{js,ts,jsx,tsx}` for class names. If a developer changes a `className` in a TSX file, Wireit will skip `build:css` because no tracked input changed. The stale `index.generated.css` is then fed into `build:webview`, producing a build with missing CSS classes.

**Fix:** Add `./webview/src/**/*.{ts,tsx,js,jsx}` and `./webview/index.html` to `build:css.files`.

### Finding B: `build:webview` missing config inputs
`build:webview` does not list:
- `postcss.config.js` — exists at `webview/postcss.config.js`
- `tsconfig.json` — exists at `webview/tsconfig.json`

Changes to these configs will not invalidate the Wireit cache.

**Fix:** Add both to `build:webview.files`.

---

## 2. `prepare` Hook — Unsafe for Published Package

```json
"prepare": "npm run build"
```

`prepare` runs automatically when this package is installed as a dependency (`npm install`). The build requires **devDependencies** (Vite, Tailwind, Wireit, TypeScript) that are **not** installed in a consumer's node_modules. Only `dependencies` are installed for dependent packages. This causes `npm install` to fail with "command not found" errors.

The package already has `"prepack": "npm run build"`, which is the correct lifecycle hook for build-before-publish.

**Fix:** Remove the `prepare` script entirely. Rely on `prepack` + CI builds.

---

## 3. Extension Reloader — Local vs npm Handling

The `isLocalExtension` logic is sound for the documented symlink workflow:
- `node_modules/` → npm → skip rebuild ✅
- Symlink under `~/.pi/agent/extensions/` → local → rebuild ✅
- Absolute explicit path → local → rebuild ✅

One minor edge: a copied (non-symlinked) directory under `extensions/` is treated as npm and skipped. This is defensible but should be documented.

---

## 4. Race Conditions & Edge Cases

### Finding C: Filename heuristic silently fails for hyphenated names
```ts
entry.toLowerCase().includes(extName.toLowerCase().replace(/-/g, ""))
```

For `pi-ask-user-glimpse`, this produces `piaskuserglimpse`. A cache file named `pi-ask-user-glimpse.mjs` does **not** contain `piaskuserglimpse`, so the filename heuristic always fails. The extension relies solely on the slower, less reliable content heuristic (first 2000 bytes).

**Fix:** Preserve hyphens in the search string, or normalize the cache filename before comparison.

### Finding D: `resolveExtensionPath` accepts file paths but `rebuildWebview` assumes directories
If the user passes an exact `.ts` file path, `resolveExtensionPath` returns that file path. `rebuildWebview` then does `join(extPath, "package.json")`, which creates an invalid path like `/path/to/index.ts/package.json`. It silently warns "No package.json" and skips.

**Fix:** In `rebuildWebview`, detect if `extPath` is a file and resolve its directory first.

---

## 5. Error Handling — Adequate but Gaps Exist

- Broad try/catch in cache scanning is appropriate. ✅
- Build failure surfaces via `notify` with error message. ✅
- **Gap:** If `findJitiCacheDir()` returns `undefined`, the user receives no notification that the cache was *not* cleared. They may incorrectly assume it was.

**Fix:** Add an explicit warning when no jiti cache directory is found.

---

## 6. Security — Path Traversal Vulnerability (CRITICAL)

### Finding E: `resolveExtensionPath` allows directory escape
When `nameOrPath` does not start with `/` or `~`, the function does:
```ts
const directPath = join(base, nameOrPath);
```

`nameOrPath` is not sanitized. A value like `../../.ssh/foopkg` resolves to `~/.ssh/foopkg`. If that directory contains a `package.json`, `isLocalExtension` returns `true` (absolute paths are treated as local), and `rebuildWebview` executes `npm run build` in that directory.

This is **arbitrary directory npm execution** via path traversal. While not classic shell injection (the command string is hardcoded), it allows an attacker to trigger `npm` scripts in unexpected directories.

**Fix:** Reject `nameOrPath` containing `..` or path separators before joining with `base`. Only allow bare extension names (alphanumeric + hyphens) for the relative resolution branch.

### Finding F: Absolute path bypass in `isLocalExtension`
Any absolute path not under `node_modules/` is treated as local. So `/rebuild-extension /tmp/malicious-package` would run `npm run build` in `/tmp/malicious-package`. Since this is a user-facing command, it's mostly self-attack, but combined with path traversal it becomes exploitable.

**Fix:** Validate that resolved paths are either under `~/.pi/agent/extensions/` or under a known safe directory.

---

## 7. Approval Recommendation

| Criterion | Status |
|-----------|--------|
| Build system correctness | ❌ Missing Wireit inputs |
| Install safety | ❌ `prepare` breaks `npm install` |
| Local/npm discrimination | ✅ Correct for symlink workflow |
| Cache clearing reliability | ❌ Hyphen heuristic bug |
| Error handling | ⚠️ Adequate, missing cache-not-found warning |
| Security | ❌ Path traversal + arbitrary cwd execution |

**Overall: NO — requires fixes**

---

## Required Fixes (merge blocker)

1. **package.json**: Remove `"prepare": "npm run build"`
2. **package.json**: Add `postcss.config.js` and `tsconfig.json` to `build:webview.files`
3. **package.json**: Add `./webview/src/**/*.{ts,tsx,js,jsx}` to `build:css.files`
4. **reloader**: Sanitize `nameOrPath` in `resolveExtensionPath` — reject `..`, `/`, and `\\` in the relative branch
5. **reloader**: Fix cache filename heuristic to handle hyphens correctly
6. **reloader**: Add warning when jiti cache directory is not found
7. **reloader**: Handle file-path inputs in `rebuildWebview` (resolve to dirname)

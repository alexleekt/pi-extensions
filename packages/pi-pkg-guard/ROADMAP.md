# pi-pkg-guard Rename Plan: `pi-pkg-guard` → `@alexleekt/pi-pkg-guard`

## Why

All other pi packages use the `@alexleekt/` scope (`pi-bump`, `pi-ask-user-glimpse`).
`pi-pkg-guard` is the only unscoped package. Scoping:
- Prevents name collisions on npm
- Signals ownership
- Makes `npm install -g @alexleekt/pi-pkg-guard` consistent with siblings

## Files to Change

### Critical (must change before publish)

| File | Change |
|------|--------|
| `package.json` name | `"pi-pkg-guard"` → `"@alexleekt/pi-pkg-guard"` |
| `package.json` repository.url | `"git+https://github.com/alexleekt/pi-pkg-guard.git"` → `"git+https://github.com/alexleekt/pi-extensions.git"` |
| `package.json` homepage | `"https://github.com/alexleekt/pi-pkg-guard#readme"` → `"https://github.com/alexleekt/pi-extensions/tree/main/packages/pi-pkg-guard#readme"` |
| `package.json` bugs.url | `"https://github.com/alexleekt/pi-pkg-guard/issues"` → `"https://github.com/alexleekt/pi-extensions/issues"` |
| `package.json` files | Remove `"biome.json"` (monorepo uses root config) |
| `README.md` h1 | `# pi-pkg-guard` → `# @alexleekt/pi-pkg-guard` |
| `README.md` badge | `badge.fury.io/js/pi-pkg-guard` → `badge.fury.io/js/%40alexleekt%2Fpi-pkg-guard` |
| `README.md` install | `pi install npm:pi-pkg-guard` → `pi install npm:@alexleekt/pi-pkg-guard` |
| `README.md` clone URL | `git clone https://github.com/earendil-works/pi-mono.git` → `git clone https://github.com/alexleekt/pi-extensions.git` |

### Schema URLs (separate but related issue)

`schema/package-snapshot.json` references `earendil-works/pi-mono` (old org).
These should point to the current monorepo:

```
https://raw.githubusercontent.com/alexleekt/pi-extensions/main/packages/pi-pkg-guard/schema/package-snapshot.json
```

### Historical / changelog (do not change)

- `CHANGELOG.md` — keep historical references as-is (it's a log)
- Old release notes mentioning `pi-pkg-guard` v0.x — preserve

### Internal dev files (update for consistency)

- `.pi/agents/doc-master.md` — install command example
- `.pi/agents/typescript-architect.md` — status key comment
- `.pi/teams.yaml` — header comment
- `.a5c/processes/` — process IDs and names

## Version Bump

Major or minor? **Minor (0.12.0 → 0.13.0)** is acceptable because:
- The package is pre-1.0
- The API surface hasn't changed
- npm users will need to update their install command, but the extension works identically

If being strict about semver: **Major (1.0.0)** since the package name change breaks existing `npm install -g pi-pkg-guard` workflows.

## Post-publish

1. Deprecate old `pi-pkg-guard` on npm:
   ```bash
   npm deprecate pi-pkg-guard "Moved to @alexleekt/pi-pkg-guard. Please update your install command."
   ```
2. Update any personal dotfiles that reference the old name
3. Update pi-extensions monorepo README to reflect new scoped name

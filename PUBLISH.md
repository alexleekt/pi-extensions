# Publishing Packages

Quick-reference for releasing `@alexleekt/*` packages from this monorepo.

## Release an Existing Package

`main` is protected. Do not use the old direct-push flow, and do not push the
publish tag before the release commit is merged. Use a release branch and PR:

```bash
# 1. Start from an up-to-date main, in a clean or isolated worktree.
git switch main
git pull --ff-only origin main
git switch -c release/<pkg>-<version>

# 2. Bump the package and lockfile, then update its changelog.
(cd packages/<pkg> && npm version --no-git-tag-version <version>)
git add packages/<pkg>/package.json package-lock.json packages/<pkg>/CHANGELOG.md
git commit -m "chore(<pkg>): release v<version>"

# 3. Push the branch and open a PR. Do not push the tag yet.
git push -u origin release/<pkg>-<version>
gh pr create --base main --head release/<pkg>-<version>

# 4. Wait for every required check, then merge the PR.
gh pr checks <number> --watch
gh pr merge <number> --merge --delete-branch

# 5. Tag the merged commit and push only the tag.
git fetch origin main --tags
git switch main
git merge --ff-only origin/main
git tag "@alexleekt/<pkg>@<version>"
git push origin "@alexleekt/<pkg>@<version>"
```

The scoped tag triggers `.github/workflows/publish.yml`. The tag must point to
the merged release commit so the published source and `main` stay aligned.
The `just release` recipe still reflects the legacy direct-push flow; use the
branch/PR procedure above until that recipe is made protection-aware.

## Bootstrap a NEW Package (First-Time Publish)

A package **must exist on npm** before Trusted Publishing (CI) can work.

```bash
# 1. Publish manually from your machine
cd packages/<pkg>
npm login
npm publish --access public

# 2. On npmjs.com, link the package to this repo for Trusted Publishing
#    Package Settings → Publish → Link to GitHub repository
#    Repository: alexleekt/pi-extensions
#    Workflow: .github/workflows/publish.yml

# 3. Future releases use `just release` automatically
```

## Pre-Release Checklist (Agent Protocol)

Before pushing a release tag, verify:

- [ ] `package.json` has `repository.url` set to `https://github.com/alexleekt/pi-extensions`
- [ ] Version in `package.json` matches the tag you are about to push
- [ ] `npm run typecheck` (or `npm run check`) passes
- [ ] `CHANGELOG.md` is updated (optional but recommended)
- [ ] For **new packages**: already manually bootstrapped on npm (see above)

## Package Status

| Package | npm Latest | Repo Version | Bootstrap Status |
|---|---|---|---|
| `pi-ask-user-glimpse` | `0.4.1` | `0.4.1` | ✅ Released |
| `pi-bump` | `0.3.0` | `0.3.0` | ✅ Released |
| `pi-heading` | `0.1.1` | `0.1.1` | ✅ Released |
| `pi-pkg-guard` | `0.13.0` | `0.13.0` | ✅ Released |
| `pi-shared` | `0.1.2` | `0.1.2` | ✅ Released |

## Troubleshooting

| Error | Meaning | Fix |
|---|---|---|
| `ENEEDAUTH` | npm token lacks publish permission for this package | Add package to your npm token's scope, or bootstrap manually |
| `E422` + `repository.url is ""` | Trusted Publishing provenance validation failed | Add `repository` field to `package.json` |
| `E404` | Package does not exist on npm yet | Bootstrap manually with `npm publish` first |
| `E403` | Package exists but CI isn't authorized | Link GitHub repo on npmjs.com for Trusted Publishing |

## How It Works

1. You push a tag: `@alexleekt/<pkg>@<version>`
2. GitHub Actions runs `.github/workflows/publish.yml`
3. The workflow validates the tag version matches `package.json`
4. If the package exists on npm → Trusted Publishing (OIDC provenance) publishes it
5. If the package is new and `NPM_TOKEN` secret exists → token-based fallback publishes it
6. If neither → workflow fails with instructions

## See Also

- [`TRUSTED_PUBLISHING.md`](./TRUSTED_PUBLISHING.md) — One-time npm setup guide
- [`justfile`](./justfile) — `just release <pkg> <version>` recipe

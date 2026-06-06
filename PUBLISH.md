# Publishing Packages

Quick-reference for releasing `@alexleekt/*` packages from this monorepo.

## Release an Existing Package (1 minute)

```bash
# Option A: Use just (recommended)
just release <pkg> <version>
# e.g. just release pi-heading 0.1.2

# Option B: Manual steps
(cd packages/<pkg> && npm version --no-git-tag-version <version>)
git add packages/<pkg>/package.json package-lock.json
git commit -m "chore(<pkg>): release v<version>"
git tag "@alexleekt/<pkg>@<version>"
git push origin main "@alexleekt/<pkg>@<version>"
```

CI handles the rest. The `publish.yml` workflow triggers on the tag push and publishes to npm.

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

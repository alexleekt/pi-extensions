# Release Process

> Release workflow for pi-pkg-guard

---

## Automated CI/CD

This project uses **GitHub Actions with Trusted Publishing** (OIDC-based) for automated npm publishing.

### Creating a Release

Follow the **`publish` skill** at `.agents/skills/publish/SKILL.md`. In short:

1. Bump the version in `package.json` and update `CHANGELOG.md` on a release branch.
2. Open a release pull request and wait for all required checks.
3. After the PR merges, tag the merged commit and push the tag:

```bash
git tag -a "@alexleekt/pi-pkg-guard@0.3.0" -m "Release @alexleekt/pi-pkg-guard@0.3.0"
git push origin "@alexleekt/pi-pkg-guard@0.3.0"
```

The legacy `just release` recipe in the package justfile has been removed; it tagged the local checkout without a merged release PR.

### What Happens Automatically

1. GitHub Actions runs all checks (biome, tests, typecheck)
2. Publishes to npm with provenance
3. Creates GitHub Release with auto-generated notes
4. Links package to GitHub source for security

---

## Manual Release Steps

If the tag step is done by hand instead of via the publish skill, the version bump, changelog, and release PR are still required first. Tag the commit merged to `main`, never an unmerged local checkout:

```bash
# 1. Update the local main to the merged release commit
git switch main
git pull --ff-only origin main

# 2. Tag the merged release commit and push the tag
git tag -a "@alexleekt/pi-pkg-guard@0.3.0" -m "Release @alexleekt/pi-pkg-guard@0.3.0"
git push origin "@alexleekt/pi-pkg-guard@0.3.0"
```

---

## Pre-Release Checklist

- [ ] Version updated in `package.json`
- [ ] Entry added to `CHANGELOG.md`
- [ ] All tests pass: `just test`
- [ ] All checks pass: `just check`
- [ ] No uncommitted changes: `git status`

---

## Troubleshooting

### Trusted Publishing Issues

**Problem:** 404 or ENEEDAUTH errors  
**Cause:** Node.js 22 includes npm 10.x with buggy Trusted Publishing support  
**Solution:** Workflow uses Node.js 24+ (npm 11.5.1+)

**Problem:** GitHub release creation fails with 403  
**Cause:** Missing `contents: write` permission  
**Solution:** Ensure workflow has:
```yaml
permissions:
  id-token: write   # OIDC for npm
  contents: write   # For GitHub releases
```

### CI Debugging

**⚠️ Don't version-bump every CI fix attempt.**

Use `workflow_dispatch` for testing CI changes without creating new releases:

```yaml
on:
  push:
    tags: ['v*']
  workflow_dispatch:  # Manual trigger for testing
```

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

| Version | Meaning |
|---------|---------|
| MAJOR | Breaking changes |
| MINOR | New features (backward compatible) |
| PATCH | Bug fixes |

---

*[← Back to Development](./README.md)*

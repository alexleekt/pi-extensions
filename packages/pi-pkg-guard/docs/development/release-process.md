# Release Process

> Release workflow for pi-pkg-guard

---

## Automated CI/CD

This project uses **GitHub Actions with Trusted Publishing** (OIDC-based) for automated npm publishing.

### Creating a Release

```bash
# Using just (recommended) - auto-detects version from package.json
just release

# Or specify version explicitly
just release 0.3.0
```

This creates and pushes a git tag, triggering the release workflow.

### What Happens Automatically

1. GitHub Actions runs all checks (biome, tests, typecheck)
2. Publishes to npm with provenance
3. Creates GitHub Release with auto-generated notes
4. Links package to GitHub source for security

---

## Manual Release Steps

If not using `just release`:

```bash
# 1. Update version in package.json
vim package.json

# 2. Update CHANGELOG.md
vim CHANGELOG.md

# 3. Commit changes
git add -A
git commit -m "chore(release): v0.3.0"

# 4. Create and push tag
git tag -a v0.3.0 -m "Release v0.3.0"
git push origin v0.3.0
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

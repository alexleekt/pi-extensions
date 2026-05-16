# Agent Guidelines: pi-pkg-guard

**Scope:** Pi extension development and maintenance  
**Last Updated:** 2026-05-06  
**Version:** 1.3

---

## Communication Style

- Be direct and concise in technical discussions
- When suggesting changes, explain the "why" behind recommendations
- Flag any security implications immediately
- Ask clarifying questions if requirements are ambiguous

---

## Code Conventions

### TypeScript Standards

- **Always use TypeScript** for all source files
- Use strict type checking - avoid `any` types
- Define interfaces for all data structures (PackageStatus, PiSettings, etc.)
- Use type guards for runtime validation (isPiSettings, isBashToolInput)

### Code Organization

```typescript
// Follow this structure in extensions/index.ts:
// 1. Constants (STATUS_KEY, CHECK_INTERVAL_MS)
// 2. Types (interfaces and type definitions)
// 3. Type Guards (runtime validation functions)
// 4. Core Functions (grouped by purpose)
// 5. Extension Entry Point (export default function)
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Constants | UPPER_SNAKE_CASE | `STATUS_KEY`, `CORE_PACKAGE` |
| Functions | camelCase | `checkRegistrationStatus()`, `registerPackages()` |
| Interfaces | PascalCase | `PackageStatus`, `PiSettings` |
| Type Guards | is + TypeName | `isPiSettings()`, `isBashToolInput()` |

---

## Testing Requirements

### Mandatory Test Coverage

**ALWAYS run tests before committing:**

```bash
just test
# or
npm test
```

### Test Standards

- All type guards must have comprehensive test coverage
- Test both good cases and edge cases
- Test error conditions (null, undefined, invalid types)
- Use descriptive test names: "should detect X when Y"

### Test File Organization

```
test/
├── analysis.test.ts     # Package analysis tests
├── gist.test.ts         # Gist utility tests
├── i18n-keys.test.ts    # Translation key validation
└── regex.test.ts        # Pattern matching tests
```

---

## Tool Usage Patterns

### When Working with Pi Extension API

```typescript
// ✅ DO: Use proper event handlers
pi.on("session_start", async (event, ctx) => {
  if (event.reason !== "startup") return;
  // ...
});

// ✅ DO: Set status with namespace
ctx.ui.setStatus(STATUS_KEY, "message");

// ✅ DO: Use notifications for warnings
ctx.ui.notify("message", "warning");

// ✅ DO: Register commands with clear names
pi.registerCommand("pi-pkg-guard", {
  description: "Clear description of what this does",
  handler: async (_args, ctx) => { /* ... */ }
});
```

### File Operations

```typescript
// ✅ DO: Always wrap file operations in try-catch
function readPiSettings(): PiSettings {
  try {
    const content = readFileSync(SETTINGS_PATH, "utf-8");
    // ...
  } catch {
    return {}; // Fail silently for non-critical ops
  }
}
```

---

## Workflow Rules

### Before Making Changes

1. **Read the relevant code first** - Understand existing patterns
2. **Check for similar implementations** - Follow established conventions
3. **Identify test impact** - Will existing tests need updates?

### When Making Changes

1. **Edit precisely** - Use Edit tool for targeted changes
2. **Update tests** - Add/modify tests for new behavior
3. **Run full test suite** - All 284 tests must pass
4. **Run linting** - Ensure code style compliance:
   ```bash
   just check
   # or
   npx @biomejs/biome check .
   ```

### Before Committing

1. **Verify test coverage** - Run `npm test`
2. **Check code style** - Run `just format` if needed
3. **Review type safety** - Ensure no TypeScript errors
4. **Test the extension locally** - Install and verify in pi

### Startup Check: Extension Loading Verification

When starting work on this project, verify pi-coding-agent will load the **latest version** (not a stale global npm version):

```bash
# 1. Check current version in repo
cat package.json | grep '"version"'

# 2. Verify symlink points to this repo (development mode)
ls -la ~/.pi/agent/extensions/pi-pkg-guard
# Expected: symlink -> /Users/alexleekt/git/pi-pkg-guard

# 3. Check for conflicting global npm installations
npm list -g pi-pkg-guard
# Expected: (empty) or not found - any global version may conflict

# 4. If global version exists, remove it
npm uninstall -g pi-pkg-guard
```

**Why this matters:**
- Symlink (dev mode): Loads directly from repo, immediate code changes
- Global npm: May load stale version 0.4.9 instead of latest 0.7.0+
- Conflict causes confusing behavior where code changes don't reflect in pi

**Golden rule:** Only one loading method should be active - symlink for development, npm for production use.

---

## Release Process

### Semantic Versioning

This project follows [Semantic Versioning 2.0.0](https://semver.org/) with conventional commits:

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `BREAKING CHANGE:` or `feat!:` | **MAJOR** (1.2.0 → 2.0.0) | API changes that break compatibility |
| `feat:` | **MINOR** (1.2.0 → 1.3.0) | New features, backward compatible |
| `fix:` | **PATCH** (1.2.0 → 1.2.1) | Bug fixes, backward compatible |
| `docs:`, `style:`, `refactor:`, `test:`, `chore:` | **No bump** | Internal improvements |

**Commit Message Format:**
```
type(scope): subject

body (optional)

BREAKING CHANGE: description (if applicable)
```

**Examples:**
```bash
feat(security): add Gist ID validation
fix(i18n): handle empty string in select expressions
docs(architecture): reorganize documentation structure
refactor(naming): rename PackageDiff to PackageStatus
```

### Automated CI/CD (Recommended)

This project uses **GitHub Actions with Trusted Publishing** (OIDC-based) for automated npm publishing:

**Setup (One-Time):**
1. Go to npm package page → "Publish Settings" → "Add Trusted Publisher"
2. Configure: Provider=GitHub Actions, Owner=`alexleekt`, Repository=`pi-pkg-guard`, Workflow=`publish.yml`
3. No `NPM_TOKEN` secret needed - OIDC handles authentication

**Benefits of Trusted Publishing:**
- No long-lived tokens to manage or rotate
- Each publish uses short-lived OIDC tokens
- More secure than classic API tokens
- Works with provenance attestation

**Creating a Release:**
```bash
# Using just (recommended) - auto-detects version from package.json
just release

# Or specify version explicitly
just release 0.3.0

# Or manually create tag
git tag -a v0.3.0 -m "Release v0.3.0"
git push origin v0.3.0
```

**What happens automatically:**
1. GitHub Actions runs all checks (biome, tests, typecheck)
2. Publishes to npm with provenance
3. Creates GitHub Release with auto-generated notes
4. Links package to GitHub source for security

**Note:** Manual GitHub Release creation is not needed - it's automated when you push the tag.

Monitor at: https://github.com/earendil-works/pi-mono/actions

**Fallback:** If Trusted Publishing isn't available, use classic token-based auth by adding `NPM_TOKEN` secret and uncommenting `NODE_AUTH_TOKEN` in publish.yml.

### Version Bump Checklist

When preparing a release:

1. **Analyze commits since last tag** to determine version bump:
   ```bash
   # Find last tag
   git describe --tags --abbrev=0
   
   # Check for breaking changes
   git log v0.8.2..HEAD --format='%B' | grep -c 'BREAKING CHANGE'
   
   # Check for new features
   git log v0.8.2..HEAD --format='%s' | grep -c '^feat'
   
   # Check for fixes
   git log v0.8.2..HEAD --format='%s' | grep -c '^fix'
   ```

2. **Update version in `package.json`**

3. **Add entry to `CHANGELOG.md`** following format:
   ```markdown
   ## [0.9.0] - 2026-04-23
   
   ### Changed
   - Refactor: rename types for clarity (PackageDiff→PackageStatus, orphaned→unregistered)
   - Documentation: reorganize docs into epics/, user-guides/, reference/, development/
   
   ### Added
   - 104 new tests covering session start, npm guard, restore workflow, gist ops, menu nav
   - Architecture decisions document (naming RFC)
   
   ### Fixed
   - Test coverage gaps for all 5 documented traceability areas
   ```

4. **Run full test suite:** `just check`

5. **Run `npm publish --dry-run`** to verify package contents

6. **Create and push git tag** to trigger publish workflow:
   ```bash
   just release 0.9.0
   # or manually:
   git tag -a v0.9.0 -m "Release v0.9.0: naming refactor, docs reorg, test coverage"
   git push origin v0.9.0
   ```

### Pre-Release Verification (CRITICAL)

**Always run full checks BEFORE tagging.** CI failures after tagging require force-pushing the tag:

```bash
# Step 0: Run full check suite (catches 90% of CI failures)
just check

# This runs:
# - biome format (catches package.json indentation, import sorting)
# - biome lint
# - tests (all must pass)
# - TypeScript typecheck
```

**Common pre-release failures:**

| Issue | Cause | Fix |
|-------|-------|-----|
| Biome format error | `jq` changed package.json to 2-space indent | `just fix` then commit |
| Import sorting | New test files have unsorted imports | `just fix` then commit |
| Test failure | Logic error or mock issue | Fix code, commit |
| Type error | TypeScript compilation failed | Fix types, commit |

**Recovery if CI fails after tagging:**

```bash
# 1. Fix the issue locally
just fix
jj commit -m "style: fix biome formatting"

# 2. Move tag to fixed commit
git tag -d vX.Y.X
git tag -a vX.Y.X -m "Release vX.Y.X" <new-commit-hash>
git push --force origin vX.Y.X

# 3. Monitor new workflow run
gh run list --repo earendil-works/pi-mono
```

**Why this matters:** Force-pushing tags is messy and can confuse npm registry caching. Better to catch issues before tagging.

### CI/CD Debugging (Important!)

**⚠️ Don't version-bump every CI fix attempt.**

We made this mistake with v0.4.x - creating 10 patch releases just to debug the CI workflow. Here's what to do instead:

**If CI workflow fails during release:**

1. **Don't create a new version** - The code didn't change, the pipeline did
2. **Use workflow_dispatch for testing** - Add to your workflow:
   ```yaml
   on:
     push:
       tags: ['v*']
     workflow_dispatch:  # Manual trigger for testing
   ```
3. **Or fix on main without tagging** - Push commits to fix CI, then tag once
4. **Remember**: CI fixes are `chore(ci):` commits, not new releases

**The only exception**: If CI is completely broken and has never successfully published, include the fixes in ONE patch release with the code changes.

### Troubleshooting Trusted Publishing

**Problem**: 404 or ENEEDAUTH errors
- **Cause**: Node.js 22 includes npm 10.x with buggy Trusted Publishing support
- **Solution**: Use Node.js 24+ (has npm 11.5.1+ with full support)
- **See**: `.github/workflows/publish.yml` uses `node-version: '24'`

**Problem**: GitHub release creation fails with 403
- **Cause**: Missing `contents: write` permission
- **Solution**: Ensure workflow has:
  ```yaml
  permissions:
    id-token: write   # OIDC for npm
    contents: write   # For GitHub releases
  ```

### NPM Publishing (Legacy Manual Method)

```bash
# Verify before publishing
npm publish --dry-run

# Publish to npm
npm publish --access public
```
---

## Security Considerations

### File System Access

- Settings file path: `~/.pi/agent/settings.json`
- Always validate paths before file operations
- Fail silently for non-critical operations (non-blocking)

### Command Detection

```typescript
// ✅ DO: Use precise regex patterns
const NPM_GLOBAL_PATTERN = /npm\s+(install|i)\s+.*(-g|--global)/;
const PI_PACKAGE_PATTERN = /pi-[\w-]+/;

// ✅ DO: Validate input before processing
function isBashToolInput(input: unknown): input is { command?: string } {
  return typeof input === "object" && input !== null;
}
```

### Sensitive Data

- Never log or expose settings.json contents
- Don't capture npm authentication details
- Respect user privacy in all operations

---

## Common Tasks

### Adding a New Feature

1. Define the feature and its purpose
2. Add type definitions if needed
3. Implement the feature
4. Add comprehensive tests
5. Update README.md with documentation
6. Run full test suite

### Fixing a Bug

1. Write a test that reproduces the bug
2. Fix the implementation
3. Verify test passes
4. Check for regressions (run all tests)
5. Update CHANGELOG.md

### i18n/ICU MessageFormat Changes

The extension uses ICU MessageFormat for pluralization and select expressions. When modifying i18n:

```typescript
// ✅ DO: Use proper ICU plural syntax
"scan.success": "✓ Registered {count} unregistered {count, plural, one {package} other {packages}} with pi:"

// ✅ DO: Test plural forms with count=1 and count>1
// The i18n formatter uses a custom parser that handles nested braces

// ⚠️ WARNING: ICU expressions have nested braces - regex patterns must handle depth
// The formatMessage() function uses character-by-character scanning with brace depth tracking
```

**Testing i18n changes:**
```bash
# Run i18n key validation
npm test

# Test plural formatting manually
npx tsx -e "import { t } from './extensions/i18n/index.js'; console.log(t('scan.success', { count: 1 }));"
```

### Updating Dependencies

- Ask before adding new dependencies
- Prefer peerDependencies for pi-related packages
- Verify compatibility with Node.js >= 18

---

## Decision Making

### When to Ask vs. Proceed

| Scenario | Action |
|----------|--------|
| Changing extension API usage | Ask first |
| Adding new dependencies | Ask first |
| Modifying core detection logic | Ask first |
| Refactoring type guards | Proceed, then verify tests |
| Adding tests | Proceed |
| Documentation updates | Proceed |
| Bug fixes with clear solution | Proceed |

### Priority Guidelines

1. **Safety first** - Never risk corrupting user settings.json
2. **Test coverage** - New code must have tests
3. **Backward compatibility** - Avoid breaking existing users
4. **Simplicity** - Prefer simple solutions over complex ones

---

## Reference: Key Files

| File | Purpose |
|------|---------|
| `extensions/index.ts` | Main extension code |
| `extensions/i18n/index.ts` | i18n system with ICU MessageFormat support |
| `extensions/i18n/en-US.ts` | English translations |
| `extensions/i18n/types.ts` | Translation type definitions |
| `package.json` | NPM configuration |
| `README.md` | User documentation |
| `CHANGELOG.md` | Version history |
| `test/*.test.ts` | Test suites |
| `justfile` | Task runner commands |
| `biome.json` | Linting configuration |

---

## Reference: Useful Commands

```bash
# Development
just test              # Run all tests
just check             # Run all checks (format, lint, test, typecheck)
just fix               # Fix auto-fixable issues
just typecheck         # TypeScript type checking

# NPM
npm publish --dry-run  # Preview package contents
npm pack               # Create tarball for inspection
```

---

*These guidelines help maintain code quality and consistency. Update this file when workflows change.*

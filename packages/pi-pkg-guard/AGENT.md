---
parent: ../../AGENT.md
---

# AGENT.md — @alexleekt/pi-pkg-guard

> Behavioral rules for AI agents working on this codebase.

## Monorepo Context

This package lives inside the `pi-extensions` monorepo. See [`../../AGENT.md`](../../AGENT.md) for monorepo-wide conventions.

## Communication Style

- Be direct and concise in technical discussions
- When suggesting changes, explain the "why" behind recommendations
- Flag any security implications immediately
- Ask clarifying questions if requirements are ambiguous

## Code Conventions

- **Always use TypeScript** for all source files
- Use strict type checking — avoid `any` types
- Define interfaces for all data structures
- Use type guards for runtime validation (`isPiSettings`, `isBashToolInput`)

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
| Functions | camelCase | `checkRegistrationStatus()` |
| Interfaces | PascalCase | `PackageStatus`, `PiSettings` |
| Type Guards | is + TypeName | `isPiSettings()` |

## Testing Requirements

**ALWAYS run tests before committing:**

```bash
just test
# or
npm test
```

- All type guards must have comprehensive test coverage
- Test both good cases and edge cases
- Test error conditions (null, undefined, invalid types)
- Use descriptive test names: "should detect X when Y"

## Tool Usage Patterns

### Pi Extension API

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

## Workflow Rules

### Before Making Changes

1. **Read the relevant code first** — Understand existing patterns
2. **Check for similar implementations** — Follow established conventions
3. **Identify test impact** — Will existing tests need updates?

### When Making Changes

1. **Edit precisely** — Use Edit tool for targeted changes
2. **Update tests** — Add/modify tests for new behavior
3. **Run full test suite** — All 284 tests must pass
4. **Run linting** — Ensure code style compliance:
   ```bash
   just check
   # or
   npx @biomejs/biome check .
   ```

### Before Committing

1. **Verify test coverage** — Run `npm test`
2. **Check code style** — Run `just format` if needed
3. **Review type safety** — Ensure no TypeScript errors
4. **Test the extension locally** — Install and verify in pi

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
# Expected: (empty) or not found

# 4. If global version exists, remove it
npm uninstall -g pi-pkg-guard
```

**Golden rule:** Only one loading method should be active — symlink for development, npm for production use.

## Release Rules

- Follow [Semantic Versioning 2.0.0](https://semver.org/) with conventional commits
- **ALWAYS run full checks BEFORE tagging** (`just check`)
- **Never version-bump for CI-only fixes** — use `workflow_dispatch` or fix on main without tagging
- See [`docs/development/release-process.md`](docs/development/release-process.md) for full release documentation

## Security Considerations

- Settings file path: `~/.pi/agent/settings.json`
- Always validate paths before file operations
- Fail silently for non-critical operations (non-blocking)
- Never log or expose `settings.json` contents
- Don't capture npm authentication details
- Respect user privacy in all operations

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

## i18n/ICU MessageFormat Changes

When modifying i18n:

```typescript
// ✅ DO: Use proper ICU plural syntax
"scan.success": "✓ Registered {count} unregistered {count, plural, one {package} other {packages}} with pi:"

// ✅ DO: Test plural forms with count=1 and count>1
```

**⚠️ WARNING:** ICU expressions have nested braces — regex patterns must handle depth. The `formatMessage()` function uses character-by-character scanning with brace depth tracking.

## Decision Making

| Scenario | Action |
|----------|--------|
| Changing extension API usage | Ask first |
| Adding new dependencies | Ask first |
| Modifying core detection logic | Ask first |
| Refactoring type guards | Proceed, then verify tests |
| Adding tests | Proceed |
| Documentation updates | Proceed |
| Bug fixes with clear solution | Proceed |

## Priority Guidelines

1. **Safety first** — Never risk corrupting user `settings.json`
2. **Test coverage** — New code must have tests
3. **Backward compatibility** — Avoid breaking existing users
4. **Simplicity** — Prefer simple solutions over complex ones

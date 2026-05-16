# Contributing Guide

> Contribution guidelines for pi-pkg-guard

---

## Code Standards

### TypeScript

- **Always use TypeScript** — no plain JavaScript
- Use strict type checking — avoid `any` types
- Define interfaces for all data structures
- Use type guards for runtime validation

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
| Interfaces | PascalCase | `PackageDiff`, `PiSettings` |
| Type Guards | is + TypeName | `isPiSettings()`, `isBashToolInput()` |

---

## Testing

### Running Tests

```bash
just test
# or
npm test
```

### Test Requirements

- All type guards must have comprehensive test coverage
- Test both good cases and edge cases
- Test error conditions (null, undefined, invalid types)
- Use descriptive test names: "should detect X when Y"

### Test File Organization

```
test/
├── analysis.test.ts    # Package analysis tests
├── gist.test.ts        # Gist utility tests
├── i18n-keys.test.ts  # Translation key validation
└── regex.test.ts       # Pattern matching tests
```

---

## Development Workflow

1. **Create a branch** for your changes
2. **Make changes** following code standards
3. **Add tests** for new functionality
4. **Run checks:** `just check`
5. **Commit** with clear messages
6. **Push** and create a PR

---

## Pull Request Process

1. Ensure all tests pass: `just test`
2. Ensure code quality: `just check`
3. Update documentation if needed
4. Describe what changed and why

---

## i18n/ICU MessageFormat Changes

The extension uses ICU MessageFormat for pluralization. When modifying i18n:

```typescript
// ✅ DO: Use proper ICU plural syntax
"scan.success": "✓ Registered {count} unregistered {count, plural, one {package} other {packages}} with pi:"

// ✅ DO: Test plural forms with count=1 and count>1
```

**Testing i18n changes:**
```bash
# Run i18n key validation
npm test
```

---

## Translation Key Changes (v0.9.0+)

When adding new locales, use updated key names (changed from "orphaned" to "unregistered"):

| Old Key (Deprecated) | New Key |
|----------------------|---------|
| `status.orphaned_packages` | `status.unregistered_packages` |
| `scan.no_orphans` | `scan.no_unregistered` |
| `scan.found_orphans` | `scan.found_unregistered` |
| `help.avoid_orphans` | `help.avoid_unregistered` |

Legacy type aliases (`PackageDiff`, `GuardConfig`, `BackupData`) remain for backward compatibility but are marked `@deprecated`.

## Adding a New Language

1. Create translation file in `extensions/i18n/`
2. Register in `extensions/i18n/index.ts`
3. Add tests for key validation
4. Update documentation

See [i18n Guide](../reference/i18n-guide.md) for details.

---

## Questions?

- Open an issue: https://github.com/earendil-works/pi-mono/issues
- Check existing documentation

---

*[← Back to Development](./README.md)*

# Contributing Guide

> English (United States) | [← Back to Documentation](README.md)

---

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- [just](https://github.com/casey/just) command runner (optional but recommended)
- GitHub CLI (`gh`) for Gist backup testing

### Clone and Install

```bash
git clone https://github.com/earendil-works/pi-mono.git
cd pi-pkg-guard
npm install
```

### Development Mode

Link the extension for live development:

```bash
# Enable development mode (creates symlink)
just dev-mode

# Check current status
just dev-status

# Disable development mode (removes symlink)
just user-mode
```

### Available Commands

```bash
just test          # Run test suite (179 tests)
just check         # Run all checks (format, lint, test, typecheck)
just fix           # Fix auto-fixable issues
just typecheck     # TypeScript type checking only
just dev-status    # Check development mode status
```

---

## Code Standards

### TypeScript

- **Always use TypeScript** — no plain JavaScript
- Use strict type checking — avoid `any` types
- Define interfaces for all data structures
- Use type guards for runtime validation

### Code Organization

```typescript
// 1. Constants (UPPER_SNAKE_CASE)
const STATUS_KEY = "ext:pi-pkg-guard:v1";

// 2. Types (PascalCase interfaces)
interface PackageDiff { /* ... */ }

// 3. Type Guards (is + TypeName)
function isPiSettings(input: unknown): input is PiSettings { /* ... */ }

// 4. Core Functions (camelCase)
function analyzePackages(): PackageDiff { /* ... */ }

// 5. Extension Entry Point
export default function (pi: ExtensionAPI): void { /* ... */ }
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Constants | UPPER_SNAKE_CASE | `STATUS_KEY`, `CHECK_INTERVAL_MS` |
| Functions | camelCase | `analyzePackages()`, `syncOrphanedPackages()` |
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
├── analysis.test.ts    # Package analysis tests (3 tests)
├── gist.test.ts        # Gist utility tests (10 tests)
├── i18n-keys.test.ts  # Translation key validation (~40 tests)
└── regex.test.ts       # Pattern matching tests (16 tests)
```

### Testing API

The following functions are exported for testing purposes:

**Type Guards:**
- `isPiSettings(value: unknown): value is PiSettings`
- `isGuardConfig(value: unknown): value is GuardConfig`
- `isBashToolInput(value: unknown): value is { command?: string }`

**Security Validation:**
- `isValidGistId(gistId: string): boolean` - Validates hex-only gist IDs
- `isValidBackupPath(backupPath: string): boolean` - Validates safe backup paths

**Package Analysis:**
- `analyzePackages(): PackageDiff` - Detects orphaned packages
- `syncOrphanedPackages(diff: PackageDiff): void` - Syncs to settings
- `normalizePackageName(pkg: string): string` - Removes `npm:` prefix

**Pattern Matching:**
- `NPM_GLOBAL_PATTERN: RegExp` - Matches `npm install -g` commands
- `PI_PACKAGE_PATTERN: RegExp` - Matches pi-* package names
- `isGlobalPiInstall(command: string): { isMatch, packageName }` - Combined detection

---

## Translations {#translations}

We welcome translations! There are two types:

1. **Documentation** (Markdown files in `docs/`)
2. **Runtime Strings** (TypeScript files in `extensions/i18n/`)

### Technical Details

The i18n system uses a custom ~2KB implementation optimized for pi extensions:

- **74 translation keys** defined in `extensions/i18n/en-US.ts`
- **ICU MessageFormat** support for pluralization and interpolation
- **Locale detection** from `~/.pi/agent/settings.json` (defaults to "en-US")
- **Type-safe** translations via `TranslationDict` interface

### Adding a New Language

1. Copy `extensions/i18n/template.ts` to `{locale}.ts`
2. Translate all strings (see [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/))
3. Export from `extensions/i18n/index.ts`
4. Update `SUPPORTED_LOCALES` array

See `extensions/i18n/README.md` for the full translation guide.

---

### Documentation Translations

#### Adding a New Language

1. Create a new directory under `docs/` using the [IETF BCP 47](https://tools.ietf.org/html/bcp47) language tag:
   ```
   docs/
   ├── en-US/        # English (United States) - default
   ├── es-ES/        # Spanish (Spain)
   ├── de-DE/        # German (Germany)
   └── ja-JP/        # Japanese (Japan)
   ```

2. Copy all files from `docs/en-US/` to the new directory

3. Translate the content while preserving:
   - Markdown structure
   - Code blocks (don't translate code)
   - Command examples
   - File paths

4. Add the language to the language selector header:
   ```markdown
   > [English](../en-US/) | **Your Language** | [Add Translation](../CONTRIBUTING.md#translations)
   ```

#### Documentation Translation Guidelines

- Keep technical terms in English if they don't have common translations
- Use formal or informal tone consistently based on the language's conventions
- Test that code examples still work after translation
- Update the main README.md language list

---

### Runtime String Translations

The extension uses **ICU MessageFormat** for type-safe, interpolatable strings.

#### Adding a New Language

1. **Copy the template**:
   ```bash
   cp extensions/i18n/template.ts extensions/i18n/es-ES.ts
   ```

2. **Translate all strings** in the new file:
   ```typescript
   export const es_ES: TranslationDict = {
     "status.orphaned_packages": "{count, plural, one {Paquete huérfano} other {Paquetes huérfanos}}...",
     // ... translate all keys
   };
   ```

3. **Register the locale** in `extensions/i18n/index.ts`:
   ```typescript
   import { es_ES } from "./es-ES.js";
   translations.set("es-ES", es_ES);
   ```

4. **Test the translations**:
   ```bash
   just check
   just test
   ```

#### ICU MessageFormat Syntax

We support ICU MessageFormat for proper internationalization:

```typescript
// Simple interpolation
t("greeting", { name: "World" })
// "Hello, World!"

// Plurals (different languages have different plural rules)
"items": "{count, plural, one {# item} other {# items}}"
t("items", { count: 1 })  // "1 item"
t("items", { count: 5 })  // "5 items"

// Select/choice
"status": "{enabled, select, true {enabled} other {disabled}}"
t("status", { enabled: true })  // "enabled"
```

See [ICU Documentation](https://unicode-org.github.io/icu/userguide/format_parse/messages/) for full syntax.

#### Runtime Translation Guidelines

- **Use named placeholders**: `{name}` not positional `{0}`
- **Keep sentences complete**: Don't split strings for concatenation
- **Use ICU for plurals**: Languages have different plural rules
- **Test with real data**: Verify plural forms work correctly
- **Escape special characters**: Use `\\n` for newlines, `\\"` for quotes

---

### Currently Supported Languages

| Language | Code | Documentation | Runtime | Maintainer |
|----------|------|---------------|---------|------------|
| English (US) | `en-US` | ✅ | ✅ | @alexleekt |

---

## Release Process

### Creating a Release

```bash
just release        # Auto-detects version from package.json
# Or specify version:
just release 0.6.0
```

This:
1. Creates a git tag
2. Pushes to origin
3. Triggers GitHub Actions CI/CD
4. Publishes to npm with Trusted Publishing

### CI/CD

We use **GitHub Actions with Trusted Publishing** (OIDC):
- No long-lived npm tokens needed
- Automatic provenance attestation
- Auto-generated GitHub releases

See [README.md](../../README.md#release-process) for full details.

---

## Submitting Changes

1. **Create a branch** for your changes
2. **Run all checks** before committing: `just check`
3. **Add tests** for new functionality
4. **Update documentation** if behavior changes
5. **Update CHANGELOG.md** under [Unreleased]
6. **Submit a pull request** with clear description

---

## Code of Conduct

- Be respectful and constructive
- Focus on the technical merits of changes
- Help others learn and grow
- Report security issues privately

---

*[← Back to Documentation](README.md)*

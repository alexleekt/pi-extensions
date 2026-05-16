# Development Setup

> Dev environment setup guide

---

## Prerequisites

- Node.js >= 18.0.0
- [just](https://github.com/casey/just) command runner (optional but recommended)
- GitHub CLI (`gh`) for Gist backup testing

---

## Clone and Install

```bash
git clone https://github.com/earendil-works/pi-mono.git
cd pi-pkg-guard
npm install
```

---

## Development Mode

Link the extension for live development:

```bash
# Enable development mode (creates symlink)
just dev-mode

# Check current status
just dev-status

# Disable development mode (removes symlink)
just user-mode
```

### Manual Symlink (without just)

```bash
ln -s $(pwd) ~/.pi/agent/extensions/pi-pkg-guard
```

### Verify Development Mode

```bash
ls -la ~/.pi/agent/extensions/pi-pkg-guard
# Should show: symlink -> /path/to/pi-pkg-guard
```

---

## Available Commands

| Command | Description |
|---------|-------------|
| `just test` | Run test suite (179 tests) |
| `just check` | Run all checks (format, lint, test, typecheck) |
| `just fix` | Fix auto-fixable issues |
| `just typecheck` | TypeScript type checking only |
| `just dev-status` | Check development mode status |
| `just release` | Create a release |

---

## Project Structure

```
pi-pkg-guard/
├── extensions/
│   ├── index.ts          # Main extension code
│   └── i18n/
│       ├── index.ts      # i18n engine
│       ├── en-US.ts      # English translations
│       ├── es-ES.ts      # Spanish translations
│       └── types.ts      # Type definitions
├── test/
│   ├── analysis.test.ts  # Package analysis tests
│   ├── gist.test.ts      # Gist utility tests
│   ├── i18n-keys.test.ts # Translation key validation
│   └── regex.test.ts     # Pattern matching tests
├── docs/                 # Documentation
├── package.json
├── tsconfig.json
├── biome.json            # Linting config
└── justfile              # Task runner
```

---

## IDE Setup

### VS Code

Recommended extensions:
- Biome (for linting)
- TypeScript and JavaScript Language Features

### Zed

Biome is used for consistent formatting. Run `just fix` before committing.

---

## Testing Changes

1. **Make your changes** in the source files
2. **Run tests:** `just test`
3. **Check code quality:** `just check`
4. **Test in pi:** Start pi and verify functionality

---

*[← Back to Development](./README.md)*

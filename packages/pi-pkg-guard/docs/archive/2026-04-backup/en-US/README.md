# pi-pkg-guard Documentation

> English (United States) | [Add Translation](../CONTRIBUTING.md#translations)

---

## Table of Contents

- [Overview](#overview)
- [Installation](INSTALL.md)
- [Usage](USAGE.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

---

## Overview

**pi-pkg-guard** is a [pi coding agent](https://github.com/mariozechner/pi) extension that guards against orphaned pi packages — packages installed via npm but not registered in pi's settings.

### The Problem

```bash
npm install -g pi-token-burden  # Installs to npm global
# But pi doesn't know about it!
```

Without pi-pkg-guard, these "orphaned" packages remain invisible to pi, leading to:
- Missing functionality when you expect extensions to be available
- Confusion about which packages are actually installed
- Lost time debugging why features aren't working

### The Solution

**pi-pkg-guard** detects, warns, and fixes this automatically through:

1. **Startup detection** - Warns if orphaned packages are found when pi starts
2. **npm install guard** - Warns when you run `npm install -g pi-*` commands
3. **Sync command** - `/package-guard` provides a menu to scan, backup, and restore packages

### Key Features

| Feature | Description |
|---------|-------------|
| **Startup Check** | Detects orphaned packages on session start (debounced to once/hour) |
| **npm Guard** | Intercepts `npm install -g pi-*` and suggests `pi install` |
| **Scan & Sync** | Find and register orphaned packages automatically |
| **Backup** | Save to local file + optional GitHub Gist |
| **Restore** | Selectively restore packages from backup |
| **Dev Mode** | Special handling for symlinked development packages |

---

## Quick Start

```bash
pi install npm:pi-pkg-guard
```

Then in pi: run `/package-guard`

---

## Next Steps

- **[Installation Guide](INSTALL.md)** - Detailed installation options
- **[Usage Guide](USAGE.md)** - How to use all features
- **[Contributing](CONTRIBUTING.md)** - Development and translation info

---

*This documentation is maintained for English (US). To contribute translations, see [Contributing](CONTRIBUTING.md#translations).*

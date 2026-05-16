# pi-pkg-guard

> Guards against unregistered pi packages — installed via npm but not registered in pi's settings.

[![npm version](https://badge.fury.io/js/pi-pkg-guard.svg)](https://www.npmjs.com/package/pi-pkg-guard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Quick Start

```bash
pi install npm:pi-pkg-guard
```

Then in pi: `/package-guard`

---

## The Problem

```bash
npm install -g pi-token-burden  # Installs to npm global
# But pi doesn't know about it!
```

**pi-pkg-guard** detects, warns, and fixes this automatically.

An **unregistered package** is a pi extension installed via npm but not registered in pi's settings. This creates a mismatch where the package exists on your system, but pi can't use it.

---

## Features

- **Startup check** — Warns if unregistered packages found
- **npm guard** — Warns when you run `npm install -g pi-*`
- **Scan & Register** — Find and register unregistered packages automatically
- **Backup** — Save to local file + optional GitHub Gist (with versioned schema)
- **Restore** — Selectively restore packages from backup with automatic legacy migration
- **Schema Validation** — Strict backup validation with `$schema` field for future-proofing
- **Multi-language** — English, Spanish, and more (ICU MessageFormat)

---

## Documentation

📚 **[View Documentation](docs/README.md)** — Complete documentation index

**Quick Links:**
- [Getting Started](docs/user-guides/getting-started.md) — First time tutorial
- [Installation](docs/user-guides/installation.md) — Install options
- [Usage Guide](docs/user-guides/usage.md) — Complete feature guide
- [Backup Strategies](docs/user-guides/backup-strategies.md) — Best practices for backups
- [Multi-Machine Setup](docs/user-guides/multi-machine-setup.md) — Sync across devices
- [Troubleshooting](docs/user-guides/troubleshooting.md) — Common issues & solutions

**Reference:**
- [Architecture](docs/reference/architecture.md) — Technical design
- [API](docs/reference/api.md) — Extension API
- [Security Model](docs/reference/security.md) — Security validations
- [i18n Guide](docs/reference/i18n-guide.md) — Translation contributor guide

**Development:**
- [Contributing](docs/development/contributing.md) — Contributor guidelines
- [Testing](docs/development/testing.md) — Test writing guide
- [Release Process](docs/development/release-process.md) — Release workflow

---

## Quick Commands

| Command | Action |
|---------|--------|
| `/package-guard` | Open interactive menu |
| `/package-guard scan` | Scan and fix unregistered packages |
| `/package-guard backup` | Save backup (local + Gist) |
| `/package-guard restore` | Restore packages from backup |
| `/package-guard config` | Open configuration settings |

## In-Menu Navigation

Menu items are numbered for quick selection:

| # | Option |
|---|--------|
| 1 | Scan / Register |
| 2 | Backup |
| 3 | Restore |
| 4 | Config |
| 5 | Exit |

## Passive Warnings

**Startup:** `3 packages to register. Run /package-guard`

**npm install:** `Use 'pi install npm:pi-foo' instead of 'npm install -g'`

---

## Development

```bash
git clone https://github.com/earendil-works/pi-mono.git
cd packages/pi-pkg-guard
cd pi-pkg-guard
npm install

just test      # Run tests
just check     # Run all checks
just release   # Create release
```

See [Contributing Guide](docs/development/contributing.md) for details.

---

## Release Process

This project uses **GitHub Actions with Trusted Publishing** (OIDC) for automated npm releases:

```bash
just release        # Auto-detects version from package.json
```

See full details in [Release Process](docs/development/release-process.md).

---

## License

MIT © Alex Lee

# Usage Guide

> Complete guide to all pi-pkg-guard features

---

## Commands

### `/package-guard`

Opens the main package-guard menu. The menu is a flat list — no section headers — so arrow-key navigation is fast.

| Option | Description |
|--------|-------------|
| **Scan** | Contextual: `🔧 Register N` when found, otherwise `Scan` |
| **Backup** | Save to local file + optional GitHub Gist |
| **Restore** | Selectively restore packages from backup |
| **Config** | Backup path, Gist, and sync settings |
| **Exit** | Close the menu |

### In-Menu Navigation

Menu items are numbered for quick reference:

| # | Option | Description |
|---|--------|-------------|
| 1 | **Scan** | Contextual: `🔧 Register N` when found, otherwise `Scan` |
| 2 | **Backup** | Save to local file + optional GitHub Gist |
| 3 | **Restore** | Selectively restore packages from backup |
| 4 | **Config** | Backup path, Gist, and sync settings |
| 5 | **Exit** | Close the menu |

### Subcommands

For power users, subcommands bypass the menu entirely:

| Subcommand | Action |
|-----------|--------|
| `/package-guard scan` | Scan, register, and offer to reload |
| `/package-guard backup` | Save backup immediately |
| `/package-guard restore` | Start restore workflow |
| `/package-guard config` | Open configuration settings |
| `/package-guard help` | Show help and usage info |

Unknown arguments fall through to the interactive menu.

---

## Passive Features

### Startup Warning

When you start pi, if unregistered packages are detected:

```
⚠️ 3 unregistered pi package(s). Run /package-guard to fix
```

This check runs at most once per hour to avoid excessive npm calls.

### npm Install Guard

When you run a bash tool with `npm install -g pi-*`:

```
⚠️ Use 'pi install npm:pi-foo' instead of 'npm install -g'
```

This prevents creating unregistered packages in the first place.

---

## Backup & Restore

### Setting Up GitHub Gist Backup

1. Install [GitHub CLI](https://cli.github.com):
   ```bash
   brew install gh
   ```

2. Authenticate:
   ```bash
   gh auth login
   ```

3. Create your first Gist backup:
   ```
   /package-guard → Set up new GitHub Gist backup
   ```

### Local Backup

Backups are always saved locally to:

```
~/.pi/agent/package-guard-backup.json
```

This file contains the list of registered pi packages and can be:
- Copied to other machines
- Stored in version control
- Used for disaster recovery

### Restoring Packages

When you run `/package-guard restore`:

1. Backup is loaded (local first, then Gist fallback)
2. Already-registered packages are filtered out
3. For 3 or fewer packages: single confirm dialog
4. For more than 3 packages: choose `Restore all`, `Pick individually`, or `Cancel`
5. Selected packages are registered and an install command is shown

---

## Understanding Unregistered Packages

An "unregistered" package is one that:

1. Is installed globally via npm (`npm list -g` shows it)
2. Has pi-related keywords in its `package.json`
3. Is **NOT** registered in `~/.pi/agent/settings.json`

### Detection Patterns

pi-pkg-guard detects pi packages by:

| Pattern | Example |
|---------|---------|
| `pi-*` prefix | `pi-timer`, `pi-token-burden` |
| `*-pi` suffix | `lsp-pi` |
| `pi-*` anywhere | `my-pi-helper` |
| Keywords | `pi-extension`, `pi-package`, `pi-coding-agent` in package.json |

### Exclusions

These are **not** considered Unregistered:

- `@earendil-works/pi-coding-agent` (core package)
- `pi-pkg-guard` itself (when running via symlink in dev mode)
- Packages without pi-related keywords

---

## Security

pi-pkg-guard includes security validations:

- **Gist ID Validation** — Prevents command injection via hex-only validation
- **Backup Path Validation** — Restricts paths to safe directories
- **npm Command Detection** — Warns against creating unregistered packages

See the [Security Model](../reference/security.md) for detailed technical documentation.

---

## Best Practices

### 1. Always Use `pi install`

```bash
# ✅ Good
pi install npm:pi-foo

# ❌ Avoid
npm install -g pi-foo
```

### 2. Run Scan After Manual npm Installs

If you must use npm directly:

```
/package-guard scan
```

### 3. Keep Backups

Create a Gist backup after installing new packages:

```
/package-guard backup
```

### 4. Check on New Machines

When setting up pi on a new machine:

```
/package-guard restore
```

---

*[← Back to User Guides](./README.md)*

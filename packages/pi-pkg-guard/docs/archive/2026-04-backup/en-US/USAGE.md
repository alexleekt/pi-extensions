# Usage Guide

> English (United States) | [← Back to Documentation](README.md)

---

## Commands

### `/package-guard`

Opens the main package-guard menu:

| Option | Description |
|--------|-------------|
| **Scan** | Find orphaned npm packages and register them in pi |
| **Backup** | Save package list to local file + optional GitHub Gist |
| **Restore** | Selectively restore packages from backup |
| **Settings** | Configure backup path and Gist sync |

---

## Passive Features

### Startup Warning

When you start pi, if orphaned packages are detected:

```
⚠️ 3 orphaned pi package(s). Run /package-guard to fix
```

This check runs at most once per hour to avoid excessive npm calls.

### npm Install Guard

When you run a bash tool with `npm install -g pi-*`:

```
⚠️ Use 'pi install npm:pi-foo' instead of 'npm install -g'
```

This prevents creating orphaned packages in the first place.

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
   /package-guard → Backup → Create new GitHub Gist
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

When you run `/package-guard` → Restore:

1. Select which backup to restore from (if multiple exist)
2. Choose which packages to restore (checkbox selection)
3. Confirm to register them in pi

---

## Understanding Orphaned Packages

An "orphaned" package is one that:

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

These are **not** considered orphaned:

- `@earendil-works/pi-coding-agent` (core package)
- `pi-pkg-guard` itself (when running via symlink in dev mode)
- Packages without pi-related keywords

---

## Security Features

pi-pkg-guard includes security validations to prevent command injection and path traversal attacks:

### Gist ID Validation

When working with GitHub Gists, all gist IDs are validated to ensure they contain only hexadecimal characters (a-f, 0-9). This prevents command injection through malicious gist IDs.

```typescript
// Internal validation - prevents attacks like:
// abc123; rm -rf /
// ../../../etc/passwd
```

### Backup Path Validation

Backup file paths are restricted to safe directories:
- `~/.pi/agent/` (pi configuration directory)
- System temporary directories (`/tmp/`, etc.)

This prevents path traversal attacks that could overwrite system files.

### npm Command Detection

The extension detects `npm install -g pi-*` commands and warns users to use `pi install npm:*` instead, preventing orphaned packages that could be exploited.

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
/package-guard → Scan
```

### 3. Keep Backups

Create a Gist backup after installing new packages:

```
/package-guard → Backup
```

### 4. Check on New Machines

When setting up pi on a new machine:

```
/package-guard → Restore
```

---

*[← Back to Documentation](README.md)*

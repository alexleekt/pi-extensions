# Getting Started with pi-pkg-guard

> Quick start tutorial for new users

---

## What You'll Learn

- What unregistered packages are
- How to check for them
- How to fix them
- How to prevent them

---

## Prerequisites

- [pi coding agent](https://github.com/earendil-works/pi-mono) installed
- Node.js >= 18.0.0
- npm (comes with Node.js)

---

## Installation (30 seconds)

```bash
pi install npm:pi-pkg-guard
```

That's it! The extension is now installed and active.

---

## Your First Scan

1. **Start pi** (if not already running)
2. **Run the scan subcommand:**
   ```
   /package-guard scan
   ```

   Or open the menu and select the contextual scan option.

You'll see one of two results:

### ✅ No unregistered packages Found
```
✓ All pi packages are registered. No unregistered packages found.
```

### ⚠️ Unregistered packages Detected
For 3 or fewer packages, they are auto-registered immediately:
```
✓ Registered 3 packages with pi:
  - npm:pi-token-burden
  - npm:pi-timer
  - npm:pi-backup

Reload pi?  [Yes] [No]
```

For more than 3 packages, you'll be asked to confirm:
```
Register all 5 unregistered packages?
[Register all] [Choose which to register] [Cancel]
```

---

## What Are Unregistered Packages?

An **unregistered package** is a pi extension installed via npm but not registered in pi's settings. This means the package exists on your system, but pi can't use it.

See the [Usage Guide](./usage.md#understanding-unregistered-packages) for complete details on detection patterns and how it works.

---

## Best Practices

### ✅ Always Use `pi install`

```bash
# ✅ Good - pi knows about it
pi install npm:pi-foo

# ❌ Avoid - creates unregistered package
npm install -g pi-foo
```

### ✅ Scan After Manual npm Installs

If you must use npm directly:

```
/package-guard scan
```

### ✅ Create Your First Backup

```
/package-guard → Backup
```

This creates a recovery point for your extension setup.

### ✅ Set Up GitHub Gist (Multi-Machine Users)

1. Install GitHub CLI: `brew install gh`
2. Login: `gh auth login`
3. In pi: `/package-guard → Config → Gist... → Create Gist`

Now your backup syncs to the cloud!

---

## Next Steps

| Action | Guide |
|--------|-------|
| Learn all features | [Usage Guide](./usage.md) |
| Detailed install options | [Installation Guide](./installation.md) |
| Backup best practices | [Backup Strategies](./backup-strategies.md) |
| Use across multiple machines | [Multi-Machine Setup](./multi-machine-setup.md) |
| Fix common issues | [Troubleshooting](./troubleshooting.md) |

---

## Quick Command Reference

| Command | Action |
|---------|--------|
| `/package-guard` | Open interactive menu |
| `/package-guard scan` | Scan and fix unregistered packages |
| `/package-guard backup` | Save backup (local + Gist) |
| `/package-guard restore` | Restore packages from backup |
| `/package-guard config` | Open configuration settings |
| `/package-guard help` | Show help text |
| `pi install npm:pi-*` | Install package correctly |
| `/reload` | Reload pi after registering packages |

---

*[← Back to User Guides](./README.md)*

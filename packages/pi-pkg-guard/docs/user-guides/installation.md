# Installation Guide

> Detailed installation options for pi-pkg-guard

---

## Recommended: Via pi

The easiest way to install pi-pkg-guard:

```bash
pi install npm:pi-pkg-guard
```

This automatically:
1. Installs the package from npm
2. Registers it in `~/.pi/agent/settings.json`
3. Makes it available immediately

---

## Alternative: Via npm

If you prefer npm directly:

```bash
npm install -g pi-pkg-guard
```

**Important:** You must manually add it to pi's settings:

```bash
# Edit ~/.pi/agent/settings.json and add:
{
  "packages": ["npm:pi-pkg-guard"]
}
```

---

## Development: Manual/Symlink

For contributing or testing changes:

```bash
git clone https://github.com/earendil-works/pi-mono.git
cd pi-pkg-guard
npm install

# Create symlink for pi to load
ln -s $(pwd) ~/.pi/agent/extensions/pi-pkg-guard
```

The extension will now load from your local repository. Use `just dev-status` to check the symlink state.

### Development Commands

```bash
just test          # Run test suite (284 tests)
just check         # Run all checks (format, lint, test, typecheck)
just fix           # Fix auto-fixable issues
just typecheck     # TypeScript type checking only
just dev-status    # Check development mode status
```

---

## Prerequisites

- **Node.js**: >= 18.0.0
- **pi coding agent**: Latest version
- **npm**: For global package management

---

## Verification

After installation, verify it's working:

```bash
# In pi, run:
/package-guard
```

You should see the package-guard menu with options for Scan, Backup, Restore, Config, and Exit. You can also use subcommands like `/package-guard scan` or `/package-guard config`.

---

## Uninstallation

```bash
# Via pi
pi uninstall npm:pi-pkg-guard

# Or via npm
npm uninstall -g pi-pkg-guard
```

---

## Troubleshooting

### Extension not appearing in pi

1. Check that it's registered in `~/.pi/agent/settings.json`:
   ```bash
   cat ~/.pi/agent/settings.json | grep pi-pkg-guard
   ```

2. Restart pi completely

3. Check for errors in pi's startup messages

### "Permission denied" during npm install

Use `sudo` only if your npm setup requires it:

```bash
sudo npm install -g pi-pkg-guard
```

Or better, [fix your npm permissions](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally).

---

*[← Back to User Guides](./README.md)*

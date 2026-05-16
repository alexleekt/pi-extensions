# Multi-Machine Setup

> Using GitHub Gist to sync packages across multiple devices

---

## Overview

Work on multiple machines? Keep your pi extensions synchronized with GitHub Gist backup.

**Workflow:**
1. Install package on Machine A
2. Backup syncs to Gist automatically
3. On Machine B, restore from Gist
4. Both machines have same packages

---

## Initial Setup

### On Your Primary Machine

1. **Ensure GitHub CLI is installed:**
   ```bash
   brew install gh
   gh auth login
   ```

2. **Create your first Gist backup:**
   ```
   /package-guard → Set up new GitHub Gist backup
   ```

3. **Verify sync is working:**
   ```
   /package-guard → Save backup to file + Gist
   ```
   
   You should see: `✓ Synced to GitHub Gist`

---

## Setting Up Additional Machines

### On Each New Machine

1. **Install pi and pi-pkg-guard:**
   ```bash
   pi install npm:pi-pkg-guard
   ```

2. **Install GitHub CLI and authenticate:**
   ```bash
   brew install gh
   gh auth login
   ```

3. **Connect to existing Gist:**
   ```
   /package-guard → Switch to a different Gist
   Enter Gist URL: https://gist.github.com/YOURNAME/GIST_ID
   ```

4. **Restore packages:**
   ```
   /package-guard → Restore packages from backup
   ```

5. **Install the packages:**
   ```bash
   pi install npm:pkg1 npm:pkg2 ...
   ```

---

## Keeping in Sync

### After Installing New Packages

**On the machine where you installed:**
```
/package-guard → Save backup to file + Gist
```

**On other machines:**
```
/package-guard → Restore packages from backup
```

### Pro Tip: Gist Backup Sync Toggle

Enable backup sync to skip the manual sync step:

```
/package-guard config → Configure Gist... → Create new Gist
```

Now every backup automatically pushes to your GitHub Gist.

---

## Managing Conflicts

### Scenario: Different Packages on Different Machines

**Solution:** Gist is the source of truth

1. Decide which machine has the "correct" package list
2. From that machine: create backup
3. From other machines: restore (overwrite local)

### Scenario: Want Machine-Specific Packages

**Solution:** Use selective restore

1. Restore from Gist shows available packages
2. Choose only the ones you want on this machine
3. Skip machine-specific packages

---

## Security Note

Your Gist contains only package names, not:
- API keys
- Personal settings
- Configuration data

The Gist is public, but package names aren't sensitive information.

---

## Troubleshooting

### "Gist not found"

Check that you're using the correct Gist URL or ID.

### "Cannot access Gist"

Ensure `gh auth login` was successful on this machine.

### "Packages already registered"

This is fine - pi-pkg-guard handles duplicates gracefully.

---

*[← Back to User Guides](./README.md)*

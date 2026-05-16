# Backup Strategies

> Best practices for backing up your pi package configuration

---

## Why Backup Matters

Your pi package configuration includes:
- All registered extensions
- Custom settings and preferences
- Gist sync configuration

Without a backup, losing this means manually reconfiguring pi on new machines or after data loss.

---

## Strategy 1: Local Backup Only

**Best for:** Single machine users who don't switch devices often.

### Setup

Default location is already configured:
```
~/.pi/agent/package-guard-backup.json
```

### Backup Command

```
/package-guard → Backup
```

(This creates local backup even without Gist configured)

### Restore

```
/package-guard → Restore
```

---

## Strategy 2: GitHub Gist Sync

**Best for:** Multi-machine users, developers who switch between work/personal machines.

### Prerequisites

```bash
# Install GitHub CLI
brew install gh

# Authenticate
gh auth login
```

### Setup

```
/package-guard → Config → Gist... → Create Gist
```

### How It Works

1. Every backup syncs to your public GitHub Gist
2. Gist ID stored in local config
3. Accessible from any machine with GitHub access
4. Gist is public but only contains package names (no secrets)

### Multi-Machine Workflow

**Machine A (Work):**
```
/package-guard → Backup
```

**Machine B (Home):**
```
/package-guard → Restore
```

---

## Strategy 3: Version Controlled Backup

**Best for:** Teams, developers who want config in their dotfiles repo.

### Setup

1. Set custom backup path to your dotfiles:
   ```
   /package-guard → Config → Backup path
   Enter: ~/.dotfiles/pi-packages.json
   ```

2. Add to version control:
   ```bash
   cd ~/.dotfiles
   git add pi-packages.json
   git commit -m "Add pi package backup"
   ```

### Benefits

- Version history of your package changes
- Synchronized across machines via git
- Auditable changes

---

## Recommended: Hybrid Approach

**Best of both worlds:**

1. **Local backup** for quick restores
2. **GitHub Gist** for multi-machine sync
3. **Optional:** Version control for dotfiles enthusiasts

---

## Backup Schedule

| When | Action |
|------|--------|
| After installing new package | Create backup |
| Weekly | Verify backup is current |
| Before major changes | Create backup |
| After config changes | Create backup |

---

## Security Considerations

### What's in the Backup

✅ **Included:**
- Package names (e.g., `npm:pi-token-burden`)
- Timestamp
- Registration status
- Schema version identifier (`$schema` field)

❌ **Not Included:**
- API keys
- Tokens
- Personal data
- pi settings (except package-guard config)

### Gist Privacy

- Gists are **public** by default
- Only contains package names
- No sensitive information
- If concerned, use local backup only

---

## Backup Format Versions

### Current Format (v0.9.0+)

All new backups include a `$schema` field for version tracking:

```json
{
  "$schema": "https://raw.githubusercontent.com/earendil-works/pi-mono/v0.9.0/packages/pi-pkg-guard/schema/package-snapshot.json",
  "timestamp": "2026-04-23T10:30:00.000Z",
  "npmPackages": ["pi-foo", "pi-bar"]
}
```

**Note:** The simplified schema stores only `npmPackages` (the canonical list). Registration state is computed at restore time by comparing against current pi settings.

### Legacy Format (v0.8.2 and earlier)

Older backups lack the `$schema` field but can be automatically migrated during restore.

### Migration

When restoring from a legacy backup:
1. Extension detects the old format
2. Prompts you to migrate
3. Optionally upgrades the saved file in-place
4. Proceeds with restore using migrated data

**No data loss:** All package information is preserved during migration.

## Troubleshooting Backups

### "Gist sync failed"

**Cause:** GitHub CLI not authenticated  
**Fix:** Run `gh auth login`

### "Invalid backup path"

**Cause:** Path outside allowed directories  
**Fix:** Use path within `~/.pi/agent/` or `/tmp/`

### "Backup file not found"

**Cause:** No backup created yet  
**Fix:** Run `/package-guard → Backup`

### "Legacy Backup Detected" message

**Cause:** Restoring from pre-v0.9.0 backup  
**Fix:** Click "Yes" to migrate — all data will be preserved

---

*[← Back to User Guides](./README.md)*

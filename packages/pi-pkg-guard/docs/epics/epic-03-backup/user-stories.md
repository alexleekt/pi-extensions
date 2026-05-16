# Epic 3 User Stories: Backup & Recovery

---

## Story 3.1: Local Package Backup

**As a** pi user  
**I want** to save my package configuration to a local file  
**So that** I have a recovery point for my extension setup  

### Acceptance Criteria

```gherkin
Given I select "Save backup to file + Gist"
When the backup operation executes
Then a JSON file should be created containing:
  - Timestamp
  - All npm global pi packages
  - Currently registered packages
  - Unregistered packages (not yet registered)

Given the backup completes successfully
When the operation finishes
Then I should see: "✓ Local backup saved: {path}"
```

### Technical Notes
- **Default Path:** `~/.pi/agent/package-guard-backup.json`
- **Customizable:** User can configure alternative path within `~/.pi/agent/` or temp directories
- **Security:** Path validation prevents path traversal attacks (must be within allowed directories)
- **Format:** Human-readable JSON with 2-space indentation
- **Implementation:** `saveLocalBackup()` with `isValidBackupPath()` check

### Traceability
| Component | File | Function/Line |
|-----------|------|---------------|
| Backup Handler | `extensions/index.ts` | `handleBackup()` |
| Data Creation | `extensions/index.ts` | `createBackupData()` |
| File Writing | `extensions/index.ts` | `saveLocalBackup()` |
| Path Validation | `extensions/index.ts` | `isValidBackupPath()` |

---

## Story 3.2: GitHub Gist Cloud Backup

**As a** pi user working across multiple machines  
**I want** to sync my package backup to a GitHub Gist  
**So that** I can restore my configuration on any machine with GitHub access  

### Acceptance Criteria

```gherkin
Given I have the GitHub CLI (gh) installed and authenticated
When I set up Gist backup for the first time
Then I should be able to create a new public Gist
And the Gist ID should be stored in my configuration

Given a Gist is configured
When I run "Save backup to file + Gist"
Then the backup should sync to GitHub Gist automatically
And I should see: "✓ Synced to GitHub Gist: https://gist.github.com/{gistId}"

Given Gist backup sync is enabled
When I disconnect the Gist via menu
Then future backups should save locally only
And I can re-enable sync later without reconfiguring the Gist ID

Given I want to switch Gists
When I select "Switch to a different Gist"
Then I should be able to enter a new Gist ID or URL
And the old Gist configuration should be replaced

Given I want to remove Gist backup
When I select "Remove Gist backup"
And I confirm the deletion
Then the Gist should be deleted from GitHub
And my local configuration should be cleared
```

### Technical Notes
- **Dependency:** Requires `gh` CLI installed and authenticated (`gh auth login`)
- **Gist ID Validation:** Hexadecimal-only (prevents command injection)
- **ID Extraction:** Supports both raw IDs and full URLs (`https://gist.github.com/user/abc123`)
- **Error Handling:** Graceful degradation if Gist sync fails (local backup still succeeds)
- **Security:** All gist IDs validated with `/^[a-f0-9]{32,}$/i` pattern
- **Implementation:** `createGist()`, `syncGistBackup()`, `deleteGist()`, `getGistContent()`

### Traceability
| Component | File | Function/Line |
|-----------|------|---------------|
| Gist Creation | `extensions/index.ts` | `createGist()` |
| Gist Sync | `extensions/index.ts` | `syncGistBackup()` |
| Gist Deletion | `extensions/index.ts` | `deleteGist()` |
| Gist Retrieval | `extensions/index.ts` | `getGistContent()` |
| ID Extraction | `extensions/index.ts` | `extractGistId()` |
| ID Validation | `extensions/index.ts` | `isValidGistId()` |

---

*[← Back to Epic README](./README.md)*

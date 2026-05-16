# Epic 4 User Stories: Configuration

---

## Story 4.1: Custom Backup Path

**As a** pi user  
**I want** to specify a custom backup file location  
**So that** I can store backups in my preferred directory structure  

### Acceptance Criteria

```gherkin
Given I select "Change where backups are saved"
When I enter a new path
Then the path should be validated to ensure it's within ~/.pi/agent/ or a temp directory

Given I enter a path starting with "~"
When the path is saved
Then it should be expanded to the full home directory path

Given I enter an invalid path (outside allowed directories)
When the path is validated
Then I should see an error and the path should not be saved
```

### Technical Notes
- **Allowed Directories:** `~/.pi/agent/` and system temp directory only
- **Path Expansion:** `~` automatically expanded to `$HOME`
- **Security:** Path traversal prevention via `resolve()` and prefix matching
- **Storage:** Custom path stored in settings under `pi-pkg-guard.backupPath`
- **Implementation:** Menu handler with `isValidBackupPath()` validation

### Traceability
| Component | File | Function/Line |
|-----------|------|---------------|
| Menu Handler | `extensions/index.ts` | Path change handler |
| Path Validation | `extensions/index.ts` | `isValidBackupPath()` |
| Config Storage | `extensions/index.ts` | `writeExtensionSettings()` |

---

## Story 4.2: Configuration Persistence

**As a** pi user  
**I want** my backup and Gist preferences to persist across sessions  
**So that** I don't need to reconfigure settings each time I use pi  

### Acceptance Criteria

```gherkin
Given I configure a custom backup path or Gist ID
When I exit and restart pi
Then my configuration should be preserved
And the settings should be available in the next session

Given configuration is stored in settings.json under "pi-pkg-guard" key
When the configuration is read
Then it should be validated using type guards before use
```

### Technical Notes
- **Storage Location:** `~/.pi/agent/settings.json` under `pi-pkg-guard` key
- **Type Safety:** Runtime validation via `isExtensionSettings()` type guard
- **Graceful Degradation:** Invalid config returns empty object, doesn't crash
- **Atomic Updates:** Full settings object rewritten with proper formatting
- **Implementation:** `readExtensionSettings()`, `writeExtensionSettings()`

### Traceability
| Component | File | Function/Line |
|-----------|------|---------------|
| Config Reading | `extensions/index.ts` | `readExtensionSettings()` |
| Config Writing | `extensions/index.ts` | `writeExtensionSettings()` |
| Type Guard | `extensions/index.ts` | `isExtensionSettings()` |
| Settings Path | `extensions/index.ts` | `SETTINGS_PATH` constant |

---

*[← Back to Epic README](./README.md)*

# Epic 2 User Stories: Package Management

---

## Story 2.1: Manual Unregistered Scan

**As a** pi user  
**I want** to manually trigger a scan for unregistered packages  
**So that** I can check package status on demand rather than waiting for startup  

### Acceptance Criteria

```gherkin
Given I run the "/package-guard" command
When I select "Find unregistered packages" from the menu
Then the system should analyze packages and display results

Given unregistered packages are found during scan
When analysis completes
Then I should see a list of unregistered packages and they should be automatically registered
And I should see: "✓ Registered {N} unregistered package(s) with pi"

Given no unregistered packages are found during scan
When analysis completes
Then I should see: "✓ All pi packages are registered. No unregistered packages found."
```

### Technical Notes
- **Auto-register:** Small batches (≤3 packages) are registered without additional confirmation
- **Format:** Registered with `npm:` prefix (`npm:pi-foo` not just `pi-foo`)
- **Reload Hint:** User notified to run `/reload` to activate packages
- **Implementation:** `executeScan()` calls `checkRegistrationStatus()` → `registerPackages()`

### Traceability
| Component | File | Function/Line |
|-----------|------|---------------|
| Menu Handler | `extensions/index.ts` | `handleRun()` |
| Analysis | `extensions/index.ts` | `analyzePackages()` |
| Sync Logic | `extensions/index.ts` | `syncUnregisteredPackages()` |
| i18n Messages | `extensions/i18n/en-US.ts` | `scan.*` keys |

---

## Story 2.2: Selective Package Restore

**As a** pi user setting up a new machine  
**I want** to selectively restore packages from a backup  
**So that** I can choose which packages to register without installing everything  

### Acceptance Criteria

```gherkin
Given I have a backup file (local or Gist)
When I select "Restore packages from backup"
Then I should see packages from backup not currently registered

Given packages are available to restore
When the restore process begins
Then I should be prompted for each package with options: Include, Skip, Include All, Skip All

Given I select packages to restore
When I confirm the selection
Then the selected packages should be registered with pi
And I should receive a command hint: "Run this command to install: pi install npm:pkg1 npm:pkg2..."

Given all packages from backup are already registered
When restore is attempted
Then I should see: "✓ All {N} packages from backup are already registered. No restore needed."
```

### Technical Notes
- **Backup Sources:** Local file (default: `~/.pi/agent/package-guard-backup.json`) or GitHub Gist
- **Interactive Flow:** Sequential prompts for each package with bulk options
- **Idempotent:** Re-registering existing packages is handled gracefully
- **Implementation:** `handleRestore()` with while-loop for package selection

### Traceability
| Component | File | Function/Line |
|-----------|------|---------------|
| Restore Handler | `extensions/index.ts` | `handleRestore()` |
| Backup Reading | `extensions/index.ts` | Local: `readFileSync()`; Gist: `getGistContent()` |
| Package Selection | `extensions/index.ts` | While loop with `ctx.ui.select()` |
| Registration | `extensions/index.ts` | Settings update with deduplication |

---

*[← Back to Epic README](./README.md)*

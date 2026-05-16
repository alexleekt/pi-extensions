# API Reference

> Extension API documentation

---

## Extension Entry Point

```typescript
export default function (pi: PiApi) {
  // Event handlers
  pi.on("session_start", handler);
  pi.on("tool_call", handler);

  // Command registration
  pi.registerCommand("package-guard", commandConfig);
}
```

---

## Event Handlers

### Session Start

```typescript
pi.on("session_start", async (event, ctx) => {
  if (event.reason !== "startup") return;
  // Check for unregistered packages
});
```

**Triggered:** When pi starts  
**Purpose:** Detect unregistered packages and display warning

### Tool Call (npm Guard)

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName !== "bash") return;
  if (!isBashToolInput(event.input)) return;
  // Check for npm install -g pi-*
});
```

**Triggered:** Before bash tool execution  
**Purpose:** Intercept npm install commands that would create unregistered packages

---

## Commands

### Registering a Command

```typescript
pi.registerCommand("package-guard", {
  description: "Package management and backup",
  handler: async (_args, ctx) => {
    // Command implementation
  }
});
```

### UI Context Methods

```typescript
// Set status widget
ctx.ui.setWidget(key, content);

// Show notification
ctx.ui.notify(message, type);

// Display menu
const choice = await ctx.ui.select(title, options);

// Get user confirmation
const confirmed = await ctx.ui.confirm(title, message);

// Get text input
const input = await ctx.ui.input(prompt, defaultValue);

// Set working message (progress indicator)
ctx.ui.setWorkingMessage("Loading...");
ctx.ui.setWorkingMessage(); // clear

// Reload pi runtime
await ctx.reload();
```

---

## Type Guards

### isPiSettings

```typescript
function isPiSettings(value: unknown): value is PiSettings {
  return typeof value === "object" && 
         value !== null &&
         "packages" in value &&
         Array.isArray(value.packages);
}
```

Validates pi settings.json structure.

### isBashToolInput

```typescript
function isBashToolInput(input: unknown): input is { command?: string } {
  return typeof input === "object" && 
         input !== null &&
         "command" in input;
}
```

Validates bash tool input for npm command detection.

### isExtensionSettings

```typescript
function isExtensionSettings(value: unknown): value is ExtensionSettings {
  return typeof value === "object" &&
         value !== null &&
         // ... additional checks
}
```

Validates pi-pkg-guard configuration object.

**Note:** Formerly `isGuardConfig()` (deprecated alias available).

---

## Backup Validation

### isPackageSnapshot

```typescript
function isPackageSnapshot(value: unknown): value is PackageSnapshot {
  // Validates all required fields and types
}
```

Type guard for backup data. Checks for required fields:
- `$schema` (string) - Schema URL
- `timestamp` (string) - ISO 8601 date
- `npmPackages` (string[]) - Global npm packages (canonical source)
- `excludedPackages` (string[], optional) - Packages excluded from registration prompts

**Note:** Formerly `isBackupData()` (deprecated alias available). The simplified schema stores only `npmPackages` - registration state is computed at restore time.

### validatePackageSnapshot

```typescript
function validatePackageSnapshot(data: unknown): ValidationResult {
  // Returns { valid: boolean, errors: string[] }
}
```

Strict validation with detailed error messages:
- Validates `$schema` URL against allowed patterns
- Checks ISO 8601 timestamp format
- Validates array element types
- Rejects unknown/additional properties

### isLegacyBackup

```typescript
function isLegacyBackup(data: unknown): boolean {
  // Detects backups without $schema field
}
```

Detects pre-schema backups (v0.8.2 and earlier) that need migration.

### migrateLegacyBackup

```typescript
function migrateLegacyBackup(data: unknown): MigrationResult {
  // Returns { migrated: boolean, data?: PackageSnapshot, errors?: string[] }
}
```

Migrates legacy backup format to current schema with `$schema` field.

---

## In-Menu Navigation

Menu items are prefixed with numbers for quick reference:

| # | Label | Handler |
|---|-------|---------|
| 1 | `🔧 Fix N unregistered packages` / `Find unregistered packages` | `executeScan` |
| 2 | `Save backup to file + Gist` | `executeBackup` |
| 3 | `Restore packages from backup` | `executeRestore` |
| 4 | `Configuration settings` | `executeConfig` |
| 5 | `Show help and usage info` | `showHelp` |
| 6 | `Exit` | — |

Numbers are hardcoded prefixes on the string labels passed to `ctx.ui.select()`. Routing compares the full prefixed string.

## Command Handlers

### executeScan

```typescript
async function executeScan(
  ctx: ExtensionCommandContext,
  options?: { offerReload?: boolean }
): Promise<void>
```

Scans for unregistered packages and registers them.

- **≤3 packages:** Auto-registered immediately
- **>3 packages:** Prompts for bulk or selective registration
- **offerReload:** When true, offers to `ctx.reload()` after registration

### executeBackup

```typescript
async function executeBackup(ctx: ExtensionCommandContext): Promise<void>
```

Saves backup locally and optionally syncs to GitHub Gist.

### executeRestore

```typescript
async function executeRestore(ctx: ExtensionCommandContext): Promise<void>
```

Restores packages from backup with selective filtering.

- **≤3 packages:** Single confirm dialog
- **>3 packages:** Bulk prompt (`Restore all` / `Pick individually` / `Cancel`)

### executeConfig

```typescript
async function executeConfig(ctx: ExtensionCommandContext): Promise<void>
```

Opens a dedicated configuration menu for backup path, Gist, and backup sync settings.

### selectPackages

```typescript
async function selectPackages(
  ctx: ExtensionCommandContext,
  packages: string[]
): Promise<string[]>
```

Interactive package selector with include/skip/bulk options. Shared helper used by scan and restore flows.

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `STATUS_KEY` | `"pi-pkg-guard:unregistered-packages"` | Status widget key |
| `CHECK_INTERVAL_MS` | `3600000` | Startup check debounce (1 hour) |
| `NPM_CACHE_TTL_MS` | `5000` | NPM cache TTL (5 seconds) |
| `NPM_GLOBAL_PATTERN` | `/npm\s+(?:install\|i).*(-g\|--global)/` | Global npm install detection |
| `PI_PACKAGE_PATTERN` | `/(?:^\|\s\|\/\|@)pi-[a-z0-9-]+/` | Package name pattern |
| `PI_KEYWORDS` | `["pi-coding-agent", ...]` | Detection keywords |

---

## File Paths

| Path | Description |
|------|-------------|
| `~/.pi/agent/settings.json` | Pi settings file |
| `~/.pi/agent/package-guard-backup.json` | Default backup location |

---

*[← Back to Reference](./README.md)*

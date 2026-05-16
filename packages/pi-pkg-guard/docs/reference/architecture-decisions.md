# Naming RFC: pi-pkg-guard Concept Clarification

> **Status:** Proposed  
> **Scope:** Variables, functions, types, and domain concepts  
> **Impact:** Medium (improves maintainability, reduces onboarding friction)

---

## Executive Summary

Based on code audit of `extensions/index.ts` (1068 lines) and test coverage analysis, this RFC proposes **15 naming improvements** to clarify intent, reduce ambiguity, and align with domain conventions. No behavioral changes—purely semantic refactoring.

---

## 1. Domain Concept: "Orphaned Packages"

### Current Usage
```typescript
interface PackageDiff {
  orphaned: string[];
  hasOrphans: boolean;
}
```

### Proposed Change
**`unregistered` / `undeclared`** — replace "orphaned" throughout codebase

### Rationale

| Issue | Explanation |
|-------|-------------|
| **Metaphorical** | "Orphaned" requires domain knowledge to understand (parent/child metaphor) |
| **Imprecise** | Suggests "abandoned" rather than "installed but not tracked" |
| **Better fit** | pi's `settings.json` has a `packages` array—"registered" = listed there |

### Implementation
```typescript
// Before
interface PackageDiff {
  orphaned: string[];
  hasOrphans: boolean;
}

// After
interface PackageStatus {
  unregistered: string[];      // installed via npm, not in settings
  hasUnregistered: boolean;
}
```

**Files affected:** `extensions/index.ts`, `extensions/i18n/en-US.ts`, test files

---

## 2. Type: `PackageDiff`

### Current Usage
Represents result of `analyzePackages()`—a state snapshot, not a comparison between versions.

### Proposed Change
**`PackageStatus`** or **`PackageRegistryState`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **Ambiguity** | "Diff" implies git-style version comparison (before/after) |
| **Reality** | This is a point-in-time snapshot of npm vs settings state |
| **Domain** | "Status" or "state" clearly indicates current condition |

### Implementation
```typescript
// Before
export function analyzePackages(): PackageDiff

// After  
export function checkRegistrationStatus(): PackageStatus
```

---

## 3. Function: `syncOrphanedPackages()`

### Current Usage
```typescript
export function syncOrphanedPackages(diff: PackageDiff): void
```

### Proposed Change
**`registerUnregisteredPackages()`** or **`adoptPackagesIntoSettings()`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **"Sync" implies bidirectional** | Cloud sync, git sync—two-way data flow |
| **Actual behavior** | One-way: adds packages from npm to settings.json |
| **"Register"** | Matches pi's concept of "registered packages" in settings |

### Implementation
```typescript
// Before
export function syncOrphanedPackages(diff: PackageDiff): void

// After
export function registerPackages(status: PackageStatus): void
```

---

## 4. Function: `analyzePackages()`

### Current Usage
```typescript
export function analyzePackages(): PackageDiff
```

### Proposed Change
**`checkRegistrationStatus()`** or **`compareNpmWithSettings()`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **"Analyze" is vague** | What analysis? Performance? Dependencies? |
| **Specific intent** | Compares npm global list with settings.json packages |
| **Dual source** | "Compare" highlights npm vs settings comparison |

### Implementation
```typescript
// Before
export function analyzePackages(): PackageDiff

// After
export function checkRegistrationStatus(): PackageStatus
```

---

## 5. Handler Functions: `handleRun()`, `handleBackup()`, `handleRestore()`

### Current Usage
```typescript
async function handleRun(ctx: ExtensionCommandContext): Promise<void>
async function handleBackup(ctx: ExtensionCommandContext): Promise<void>
async function handleRestore(ctx: ExtensionCommandContext): Promise<void>
```

### Proposed Change
**`executeScan()`**, **`executeBackup()`**, **`executeRestore()`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **"Handle" is generic** | Event handlers "handle"—these are menu action executors |
| **Active verb** | "Execute" or "perform" indicates user-triggered action |
| **Menu context** | These execute when user selects menu items |

### Implementation
```typescript
// Before
if (choice === t("menu.scan")) {
  await handleRun(ctx);
}

// After
if (choice === t("menu.scan")) {
  await executeScan(ctx);
}
```

---

## 6. Function: `isBashToolInput()`

### Current Usage
```typescript
export function isBashToolInput(input: unknown): input is { command?: string }
```

### Current Implementation
```typescript
export function isBashToolInput(input: unknown): input is { command?: string } {
  if (typeof input !== "object" || input === null) return false;
  if (Array.isArray(input)) return false;
  return true;  // Only checks shape, not content!
}
```

### Proposed Change
**`hasCommandProperty()`** or **`isNpmInstallCommandInput()`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **Overpromises** | Name suggests full bash command validation |
| **Actual check** | Only verifies object shape (has optional `command` property) |
| **Honesty** | Name should reflect minimal validation performed |

### Implementation
```typescript
// Before
export function isBashToolInput(input: unknown): input is { command?: string }

// After - be honest about what it checks
export function hasCommandProperty(input: unknown): input is { command?: string }
```

---

## 7. Function: `isValidGistId()`

### Current Usage
```typescript
export function isValidGistId(gistId: string): boolean
```

### Current Implementation
```typescript
export function isValidGistId(gistId: string): boolean {
  return /^[a-f0-9]{32,}$/i.test(gistId);  // Hex-only, 32+ chars
}
```

### Proposed Change
**`isSafeGistId()`** or **`isGistIdFormat()`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **"Valid" is ambiguous** | Does it check format or existence? |
| **Actual purpose** | Prevents command injection (shell safety) |
| **Security intent** | "Safe" makes security boundary explicit |

### Implementation
```typescript
// Before
export function isValidGistId(gistId: string): boolean

// After
export function isSafeGistId(gistId: string): boolean  // for shell execution
// OR
export function isGistIdFormat(gistId: string): boolean  // for format validation
```

---

## 8. Function: `isValidBackupPath()`

### Current Usage
```typescript
export function isValidBackupPath(backupPath: string): boolean
```

### Current Implementation
```typescript
export function isValidBackupPath(backupPath: string): boolean {
  const resolvedPath = resolve(backupPath);
  const homeDir = homedir();
  const allowedDirs = [
    resolve(join(homeDir, ".pi", "agent")),
    resolve(tmpdir()),
  ];
  // Must be within allowed directories (path traversal prevention)
}
```

### Proposed Change
**`isWithinAllowedSandbox()`** or **`isPathInSafeZone()`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **"Valid" understates** | This enforces a security boundary, not just validity |
| **Actual purpose** | Path traversal attack prevention |
| **Security model** | Makes sandbox concept explicit |

### Implementation
```typescript
// Before
export function isValidBackupPath(backupPath: string): boolean

// After
export function isWithinSandbox(backupPath: string, allowedDirs: string[]): boolean
```

---

## 9. Interface: `GuardConfig`

### Current Usage
```typescript
interface GuardConfig {
  backupPath?: string;
  gistId?: string;
  gistEnabled?: boolean;
}
```

### Proposed Change
**`ExtensionSettings`** or **`PackageGuardSettings`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **Circular naming** | `GuardConfig` in `pi-pkg-guard` is redundant |
| **pi terminology** | pi uses "settings" (settings.json) |
| **Clarity** | "Extension settings" clearly scopes to this extension |

### Implementation
```typescript
// Before
interface GuardConfig {
  backupPath?: string;
  gistId?: string;
  gistEnabled?: boolean;
}

// After
interface ExtensionSettings {
  backupFilePath?: string;      // more explicit than "path"
  gistBackupId?: string;        // clarifies purpose
  isGistSyncEnabled?: boolean;  // explicit boolean naming
}
```

---

## 10. Interface: `BackupData`

### Current Usage
```typescript
interface BackupData {
  timestamp: string;
  npmPackages: string[];
  registeredPackages: string[];
  orphanedPackages: string[];
}
```

### Proposed Change
**`PackageSnapshot`** or **`ExtensionRegistrySnapshot`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **"Data" is vague** | Everything is data—what kind? |
| **Point-in-time** | This is a snapshot at a specific moment |
| **Domain** | "Snapshot" is standard backup terminology |

### Implementation
```typescript
// Before
interface BackupData {
  timestamp: string;
  npmPackages: string[];
  registeredPackages: string[];
  orphanedPackages: string[];
}

// After
interface PackageSnapshot {
  capturedAt: string;           // clearer than "timestamp"
  globallyInstalled: string[];  // npm global packages
  registeredInPi: string[];     // pi settings packages
  notYetRegistered: string[];   // unregistered/undeclared
}
```

---

## 11. Constant: `PI_NAME_PATTERN`

### Current Usage
```typescript
const PI_NAME_PATTERN = /(^pi-|-pi$|\/pi-)/;
```

### Proposed Change
**`PI_EXTENSION_NAME_PATTERN`** or **`PI_PACKAGE_NAME_HEURISTIC`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **"Name" is generic** | Detects extension package naming conventions |
| **Pattern type** | It's a heuristic (prefix/suffix), not definitive ID |
| **Scope** | Distinguishes from `PI_KEYWORDS` which is definitive |

### Implementation
```typescript
// Before
const PI_NAME_PATTERN = /(^pi-|-pi$|\/pi-)/;

// After
const PI_EXTENSION_NAME_HEURISTIC = /(^pi-|-pi$|\/pi-)/;
```

---

## 12. Constant: `PI_KEYWORDS`

### Current Usage
```typescript
const PI_KEYWORDS = ["pi-coding-agent", "pi-extension", "pi-package"];
```

### Proposed Change
**`PI_EXTENSION_KEYWORDS`** or **`EXTENSION_MANIFEST_KEYWORDS`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **"Keywords" is generic** | Could be SEO, search, etc. |
| **Manifest context** | These are package.json `keywords` field values |
| **Definitive check** | Unlike pattern match, this is definitive identification |

---

## 13. Constant: `STATUS_KEY`

### Current Usage
```typescript
const STATUS_KEY = "ext:pi-pkg-guard:v1";
// Used with: ctx.ui.setStatus(STATUS_KEY, message)
```

### Proposed Change
**`UI_STATUS_INDICATOR_KEY`** or **`WIDGET_STATUS_KEY`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **"Status" is overloaded** | Could mean HTTP status, process status, etc. |
| **UI-specific** | This is specifically for pi's UI status zone |
| **Intent** | Makes clear it's a UI element identifier |

---

## 14. Constant: `CONFIG_KEY`

### Current Usage
```typescript
const CONFIG_KEY = "pi-pkg-guard";
// Used as namespace in settings.json: settings[CONFIG_KEY]
```

### Proposed Change
**`SETTINGS_NAMESPACE`** or **`EXTENSION_SETTINGS_KEY`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **"Config" vs "settings"** | pi uses "settings" (settings.json)—be consistent |
| **Namespace** | This is a namespace key, not a single config value |
| **Domain alignment** | Match pi's terminology |

---

## 15. Constant: `NPM_CACHE_TTL_MS`

### Current Usage
```typescript
const NPM_CACHE_TTL_MS = 5000; // 5 second cache
// Caches result of npm list -g
```

### Proposed Change
**`NPM_GLOBAL_LIST_CACHE_TTL_MS`** or **`GLOBAL_PACKAGE_CACHE_TTL_MS`**

### Rationale

| Issue | Explanation |
|-------|-------------|
| **"NPM" is broad** | Caches specific command: `npm list -g` |
| **Global vs local** | Important distinction in npm |
| **Self-documenting** | Full description reduces need for comment |

---

## Migration Plan

### Phase 1: Type/Interface Renames (Low Risk) ✅ COMPLETED
1. `PackageDiff` → `PackageStatus` ✅
2. `GuardConfig` → `ExtensionSettings` ✅
3. `BackupData` → `PackageSnapshot` ✅

### Phase 2: Function Renames (Medium Risk) ✅ COMPLETED
1. `analyzePackages()` → `checkRegistrationStatus()` ✅
2. `syncOrphanedPackages()` → `registerPackages()` ✅
3. `handleRun/Backup/Restore` → `executeScan/Backup/Restore` ✅

### Phase 3: Concept Rename (High Touch) ✅ COMPLETED
- "orphaned" → "unregistered" throughout codebase and i18n ✅

### Phase 4: Constant Renames (Low Risk) ⏳ PENDING
- `STATUS_KEY`, `CONFIG_KEY`, `NPM_CACHE_TTL_MS`, etc. (not critical)

### Phase 5: Schema Validation ✅ COMPLETED
- Added `$schema` field to `PackageSnapshot` for versioned validation
- Implemented `validatePackageSnapshot()` for strict validation
- Added legacy backup detection and migration path

---

## Acceptance Criteria

- [x] All renamed items have consistent usage across codebase
- [x] Test files updated to use new names
- [x] i18n keys updated (or aliased for backward compatibility)
- [x] No functional changes—purely semantic
- [x] AGENTS.md naming conventions section updated if applicable
- [x] Schema validation implemented with migration path

---

## Backward Compatibility

**API Impact:** These are internal names only. The extension exports a default function; individual function exports are for testing only.

**i18n Impact:** Translation keys updated from "orphaned" to "unregistered" with full test coverage.

**Schema Impact:** Legacy backups (v0.8.2 and earlier) without `$schema` field are automatically detected and migrated with user consent during restore operations.

---

*Naming RFC v1.0 — Based on code audit 2026-04-23*
*Updated 2026-04-23: All phases completed except non-critical constant renames*

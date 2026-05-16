# Security Model

> Security validations and protections

---

## Threat Model

### Attack Vectors Addressed

| Vector | Mitigation |
|--------|------------|
| Command Injection | Gist ID validation |
| Path Traversal | Backup path validation |
| Shell Injection | NPM command detection |
| File Overwrite | Directory restrictions |

---

## Validations

### Gist ID Validation

**Pattern:** `/^[a-f0-9]{32,}$/i`

**Prevents:**
```
# Command injection attempts
abc123; rm -rf /
abc123 && cat /etc/passwd

# Path traversal
../../../etc/passwd
```

**Implementation:**
```typescript
function isValidGistId(id: string): boolean {
  return /^[a-f0-9]{32,}$/i.test(id);
}
```

---

### Backup Path Validation

**Allowed Directories:**
- `~/.pi/agent/` (pi configuration)
- System temp directories (`/tmp/`, etc.)

**Prevents:**
```
/etc/passwd           # System file overwrite
../../../etc/shadow   # Path traversal
~/../../../etc/hosts  # Escaped home directory
```

**Implementation:**
```typescript
function isValidBackupPath(path: string): boolean {
  const resolved = resolve(path);
  return resolved.startsWith(ALLOWED_DIR) ||
         resolved.startsWith(TEMP_DIR);
}
```

---

### NPM Command Detection

**Pattern:** Detection of `npm install -g pi-*`

**Purpose:**
- Warn users about creating unregistered packages
- Prevent accidental misconfigurations

**Non-blocking:** Warning only, doesn't prevent execution

---

## Data Protection

### What's in Backups

✅ **Included:**
- Package names (public npm packages)
- Registration status
- Timestamps

❌ **Never Included:**
- API keys
- Authentication tokens
- Personal data
- Pi settings (except package-guard config)

### Gist Privacy

- Gists are **public** by default
- Only contains package names
- No sensitive information exposed

---

## Error Handling

### Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| Invalid Gist ID | Rejected, error message |
| Invalid path | Rejected, error message |
| Gist sync fails | Local backup still succeeds |
| NPM command fails | Returns empty array |

### Type Guards

All external data validated before use:
- `isPiSettings()` - Settings file validation
- `isExtensionSettings()` - Configuration validation (formerly `isGuardConfig`)
- `isPackageSnapshot()` - Backup file validation (formerly `isBackupData`)

### Schema Validation

Backup data undergoes strict validation:
- `validatePackageSnapshot()` - Comprehensive validation with detailed errors
- Schema URL validation against allowed patterns (prevents malicious schema URLs)
- ISO 8601 timestamp format validation
- Type checking for all array elements
- Rejection of unknown/additional properties

### Legacy Migration

Legacy backups are safely migrated:
- `isLegacyBackup()` - Detects pre-schema backups
- `migrateLegacyBackup()` - Upgrades to current schema
- User confirmation required before migration
- Optional in-place upgrade of saved backup files

---

*[← Back to Reference](./README.md)*

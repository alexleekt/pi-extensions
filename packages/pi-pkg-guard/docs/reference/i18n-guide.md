# i18n Guide for Contributors

> Translation contributor guide

---

## Overview

pi-pkg-guard uses ICU MessageFormat for internationalization with a custom parser that supports:
- Variable interpolation: `{variable}`
- Pluralization: `{count, plural, one {...} other {...}}`
- Select expressions: `{gender, select, male {...} female {...} other {...}}`

---

## Adding a New Language

### 1. Create Translation File

Create `extensions/i18n/{locale}.ts`:

```typescript
export const fr_FR: TranslationDict = {
  // Copy structure from en-US.ts
  startup: {
    warning: "{count} paquet(s) orphelin(s) pi. Exécutez /package-guard"
  },
  npm_guard: {
    warning: "Utilisez 'pi install npm:{packageName}' au lieu de 'npm install -g'"
  },
  // ... all keys
};
```

### 2. Register Locale

Add to `extensions/i18n/index.ts`:

```typescript
import { fr_FR } from "./fr-FR.js";

export function initializeI18n() {
  registerLocale("fr-FR", fr_FR);
  // ... other locales
}
```

### 3. Test Your Translation

```bash
# Run i18n key validation
npm test

# Test formatting
npx tsx -e "import { t } from './extensions/i18n/index.js'; console.log(t('startup.warning', { count: 3 }));"
```

---

## ICU MessageFormat Syntax

### Simple Variables

```typescript
"Hello, {name}!"
// Input: { name: "World" }
// Output: "Hello, World!"
```

### Pluralization

```typescript
"Found {count} Unregistered {count, plural, one {package} other {packages}}"
// count=1: "Found 1 unregistered package"
// count=5: "Found 5 unregistered packages"
```

### Select Expressions

```typescript
"{gender, select, male {He} female {She} other {They}} registered a package"
// gender=male: "He registered a package"
// gender=female: "She registered a package"
// gender=other: "They registered a package"
```

---

## Translation File Structure

```typescript
export const en_US: TranslationDict = {
  // Section: startup detection
  startup: {
    warning: "...",           // Startup unregistered warning
  },
  
  // Section: npm install guard
  npm_guard: {
    warning: "...",           // npm install warning
  },
  
  // Section: manual scan
  scan: {
    success: "...",           // Found unregistered packages message
    none: "...",              // No unregistered packages message
    reloading: "...",         // Reload hint
  },
  
  // Section: backup
  backup: {
    localSuccess: "...",      // Local backup saved
    gistSuccess: "...",       // Gist sync success
    // ... more keys
  },
  
  // Section: restore
  restore: {
    noBackup: "...",          // No backup found
    allRegistered: "...",     // All packages registered
    // ... more keys
  },
  
  // Section: menu
  menu: {
    title: "...",
    scan: "...",
    backup: "...",
    // ... more keys
  },
  
  // Section: errors
  errors: {
    gistValidation: "...",    // Invalid Gist ID
    pathValidation: "...",    // Invalid backup path
    // ... more keys
  },
  
  // Section: help
  help: {
    intro: "...",
    whatAreunregistered packages: "...",
    howToAvoid: "...",
    // ... more keys
  }
};
```

---

## Testing Translations

### Key Validation

All translation files must have the same keys as the base (en-US). Run:

```bash
npm test
```

This validates:
- All locales have all keys
- No extra keys in locales
- Nested structure matches

### Manual Testing

```bash
# Set locale and test
LANG=fr-FR pi

# In pi:
/package-guard
```

---

## Best Practices

1. **Keep messages concise** - UI space is limited
2. **Test with 1 and N items** - Verify pluralization
3. **Use full sentences** - Don't concatenate fragments
4. **Include context comments** - Explain variables
5. **Test in actual UI** - Some messages appear in tight spaces

---

*[← Back to Reference](./README.md)*

# Epic 5 User Stories: User Experience

---

## Story 5.1: Interactive Menu Interface

**As a** pi user  
**I want** a clear, interactive menu to access all package-guard features  
**So that** I can easily navigate between scan, backup, restore, and settings  

### Acceptance Criteria

```gherkin
Given I run "/package-guard"
When the menu opens
Then I should see a status widget showing:
  - Number of registered packages
  - Number of unregistered packages
  - Current backup path
  - Gist configuration status
  - Backup sync status

Given the menu is displayed
When I view the options
Then I should see clearly sectioned menu items:
  - 🔧 Register N (contextual)
  - Backup
  - Restore
  
  ═══ Configuration ═══
  - Change where backups are saved
  - [Contextual Gist options based on current state]
  
  ═══ System ═══
  - Show help and usage info
  - Exit

Given the menu is open
When I select an action
Then the action should execute
And the menu should refresh with updated status

Given I select "Exit"
When the command completes
Then the status widget should clear
And I should return to the normal pi interface
```

### Technical Notes
- **Zone Architecture:** Status widget (non-selectable) + Menu zone (selectable)
- **Contextual Items:** Gist options shown/hidden based on `config.gistId` and `ghInstalled`
- **Refresh:** Menu loop re-analyzes packages on each iteration for fresh data
- **Keyboard Navigation:** ↑↓ navigate, Enter confirm, Escape cancel
- **Implementation:** `pi.registerCommand("package-guard")` with while-loop menu

### Traceability
| Component | File | Function/Line |
|-----------|------|---------------|
| Command Registration | `extensions/index.ts` | `pi.registerCommand("package-guard")` |
| Status Widget | `extensions/index.ts` | `ctx.ui.setWidget()` |
| Menu Loop | `extensions/index.ts` | While loop with `ctx.ui.select()` |
| Contextual Logic | `extensions/index.ts` | Conditional menu items |

---

## Story 5.2: Contextual Help

**As a** pi user  
**I want** to access help information from within the package-guard interface  
**So that** I can understand how to use the features without leaving pi  

### Acceptance Criteria

```gherkin
Given I select "Show help and usage info"
When the help displays
Then I should see information about:
  - What unregistered packages are
  - How to avoid creating unregistered packages
  - Available actions and their purposes
  - Pro tips for best practices
```

### Technical Notes
- **Content:** Multi-line help text displayed in chat transcript
- **Format:** Structured sections with headers and bullet points
- **Non-blocking:** Help appears in transcript, menu can be reopened immediately
- **i18n:** Help text fully internationalized
- **Implementation:** `showHelp()` function

### Traceability
| Component | File | Function/Line |
|-----------|------|---------------|
| Help Handler | `extensions/index.ts` | `showHelp()` |
| i18n Content | `extensions/i18n/en-US.ts` | `help.*` keys |

---

## Story 5.3: Internationalization (i18n)

**As a** non-English pi user  
**I want** to interact with package-guard in my preferred language  
**So that** I can understand notifications and prompts clearly  

### Acceptance Criteria

```gherkin
Given my pi locale is set to a supported language
When package-guard displays messages
Then they should appear in my locale

Given a message includes counts or variables
When the message is formatted
Then pluralization should be handled correctly (e.g., "1 package" vs "2 packages")
```

### Technical Notes
- **ICU MessageFormat:** Full support for `{count, plural, one {...} other {...}}`
- **Locale Detection:** Auto-detected from pi settings or system locale
- **Fallback:** English (en-US) used as default if locale not supported
- **Extensible:** Additional locales can be registered via `registerLocale()`
- **Performance:** O(n) single-pass parsing with sticky regex for O(1) pattern matching
- **Implementation:** Custom ICU MessageFormat parser in `extensions/i18n/index.ts`

### Traceability
| Component | File | Function/Line |
|-----------|------|---------------|
| i18n Engine | `extensions/i18n/index.ts` | `formatMessage()`, `t()` |
| Locale Detection | `extensions/i18n/index.ts` | `detectLocale()`, `initializeI18n()` |
| Translations | `extensions/i18n/en-US.ts` | Full translation dictionary |
| Type Definitions | `extensions/i18n/types.ts` | `TranslationDict`, `TranslationKey` |

---

*[← Back to Epic README](./README.md)*

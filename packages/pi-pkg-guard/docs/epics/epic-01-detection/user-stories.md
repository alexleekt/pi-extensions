# Epic 1 User Stories: Detection & Prevention

---

## Story 1.1: Unregistered Detection on Startup

**As a** pi user  
**I want** to be warned when unregistered packages are detected during session startup  
**So that** I'm aware of package misconfigurations before they cause issues  

### Acceptance Criteria

```gherkin
Given pi has unregistered packages installed (npm global packages matching pi-* pattern with pi-extension keywords)
When a new pi session starts
Then the status area should display a warning: "{N} unregistered pi package(s). Run /package-guard"

Given no unregistered packages are detected
When a new pi session starts
Then no warning should be displayed in the status area
```

### Technical Notes
- **Detection Pattern:** `/^pi-|-pi$|\/pi-/` + keywords: `pi-coding-agent`, `pi-extension`, `pi-package`
- **Exclusions:** `@earendil-works/pi-coding-agent` (core), `pi-pkg-guard` itself
- **Performance:** NPM cache with 5-second TTL prevents repeated exec calls
- **Implementation:** `analyzePackages()`, `pi.on("session_start")` → `ctx.ui.setStatus(STATUS_KEY, ...)`

### Traceability
| Component | File | Function/Line |
|-----------|------|---------------|
| Detection Logic | `extensions/index.ts` | `analyzePackages()` |
| Event Handler | `extensions/index.ts` | `pi.on("session_start")` |
| Pattern Matching | `extensions/index.ts` | `PI_NAME_PATTERN`, `PI_KEYWORDS` |
| NPM Cache | `extensions/index.ts` | `getNpmGlobalPackages()` |

---

## Story 1.2: NPM Install Interception

**As a** pi user  
**I want** to be warned when I attempt to install pi packages via npm directly  
**So that** I don't create unregistered packages in the first place  

### Acceptance Criteria

```gherkin
Given I execute a bash command matching "npm install -g pi-*" or "npm i -g pi-*"
When the command is intercepted
Then I should receive a notification: "Use 'pi install npm:{packageName}' instead of 'npm install -g'"

Given I execute a bash command that does not match pi-package patterns
When the command runs
Then no warning should be displayed
```

### Technical Notes
- **Pattern:** `/npm\s+(install|i)\s+.*(-g|--global)/` + package name contains `pi-`
- **Timing:** Warning shown before command execution completes
- **Non-blocking:** Warning doesn't prevent command execution
- **Implementation:** `pi.on("tool_call", ...)` checking `isBashToolInput()`

### Traceability
| Component | File | Function/Line |
|-----------|------|---------------|
| Pattern Detection | `extensions/index.ts` | `pi.on("tool_call")` |
| Input Validation | `extensions/index.ts` | `isBashToolInput()` |
| i18n Message | `extensions/i18n/en-US.ts` | `npm_guard.warning` |

---

*[← Back to Epic README](./README.md)*

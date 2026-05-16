# Architecture Documentation

> Technical architecture & design decisions

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     pi coding agent                       │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │   Extension  │   │   Extension  │   │   Extension  │ │
│  │  pi-pkg-guard│   │    Other     │   │    Other     │ │
│  └──────┬───────┘   └──────────────┘   └──────────────┘ │
│         │                                               │
│  ┌──────▼──────────────────────────────────────────────┐ │
│  │                  pi Extension API                  │ │
│  │  • Event handlers (session_start, tool_call)      │ │
│  │  • Command registration                          │ │
│  │  • UI context (widgets, menus, notifications)    │ │
│  └──────┬─────────────────────────────────────────────┘ │
│         │                                               │
└─────────┼───────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                      System Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │   npm    │  │ settings │  │  files   │  │  GitHub  ││
│  │  list -g │  │   json   │  │  backup  │  │   Gist   ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## Module Structure

```
extensions/
├── index.ts              # Main extension (~1700 lines)
│   ├── Constants & Types       # L24-90
│   ├── Type Guards             # L93-195
│   ├── Validation Utilities    # L198-237
│   ├── NPM Operations          # L240-309
│   ├── Settings Operations     # L312-368
│   ├── Package Analysis        # L371-447
│   ├── Backup Operations       # L450-580
│   ├── GitHub Gist Operations  # L583-750
│   ├── Command Handlers        # L753-1220
│   │   ├── executeScan()       # Selective registration, reload prompt
│   │   ├── executeBackup()     # Local + Gist sync
│   │   ├── executeRestore()    # Bulk or granular restore
│   │   ├── executeConfig()     # Dedicated config menu
│   │   ├── selectPackages()    # Shared interactive selector
│   │   └── showHelp()          # Help text
│   └── Extension Entry Point   # L1220+
│       ├── session_start       # Startup detection
│       ├── registerCommand     # /package-guard with subcommand routing
│       └── tool_call           # npm guard
│
└── api.ts                # Public API exports
```

---

## Key Design Decisions

### 1. NPM Cache with TTL

**Problem:** Repeated `npm list -g` calls are slow and expensive  
**Solution:** In-memory cache with 5-second TTL

```typescript
let npmCache: { data: string[]; timestamp: number } | null = null;
const NPM_CACHE_TTL = 5000; // 5 seconds

function getNpmGlobalPackages(): string[] {
  if (npmCache && Date.now() - npmCache.timestamp < NPM_CACHE_TTL) {
    return npmCache.data;
  }
  // ... fetch from npm
}
```

**Impact:** Menu operations feel instant during interactive use.

---

### 2. Debounced Startup Check

**Problem:** Don't want to check npm on every session  
**Solution:** Check at most once per hour

```typescript
const CHECK_INTERVAL_MS = 3600000; // 1 hour

pi.on("session_start", async (event, ctx) => {
  if (event.reason !== "startup") return;
  // Only check if last check was > 1 hour ago
});
```

**Impact:** Balances timely warnings with performance.

---

### 3. Type Guards for Runtime Safety

**Problem:** External data (settings, gist responses) may be malformed  
**Solution:** Runtime type validation

```typescript
function isPiSettings(value: unknown): value is PiSettings {
  return typeof value === "object" && 
         value !== null &&
         "packages" in value &&
         Array.isArray(value.packages);
}
```

**Impact:** Graceful degradation instead of crashes.

---

### 4. Zone-Based UI Architecture

**Problem:** Complex menus with mixed interactive and display elements  
**Solution:** Three distinct zones

| Zone | API | Purpose |
|------|-----|---------|
| Status | `ctx.ui.setWidget()` | Non-selectable display |
| Menu | `ctx.ui.select()` | Interactive navigation |
| Content | `console.log()` | Historical transcript |

**Impact:** Clear separation of concerns, intuitive UX.

---

### 5. Custom ICU MessageFormat Parser

**Problem:** Need pluralization without heavy dependencies  
**Solution:** Single-pass O(n) parser

**Features:**
- Variable interpolation
- Pluralization (one/other)
- Select expressions
- Nested expressions

**Impact:** 200 LOC vs 10KB+ library, full i18n support.

---

## Data Flow

### Startup Detection Flow

```
pi starts
    │
    ▼
session_start { reason: "startup" }
    │
    ▼
checkRegistrationStatus()
    ├─► getNpmGlobalPackages() ──► npm list -g (cached 5s)
    ├─► getRegisteredPackages() ──► read settings.json
    │
    ▼
Compare lists
    │
    ▼
unregistered packages found?
    ├─► Yes: ctx.ui.setStatus(STATUS_KEY, "N unregistered...")
    └─► No: clear status (setStatus with no message)
```

### Menu Flow

```
/package-guard [subcommand]
    │
    ▼
pi.registerCommand handler
    │
    ▼
subcommand routing?
    ├─► "scan"    ──► executeScan(ctx, { offerReload: true })
    ├─► "backup"  ──► executeBackup(ctx)
    ├─► "restore" ──► executeRestore(ctx)
    ├─► "config"  ──► executeConfig(ctx)
    ├─► "help"    ──► showHelp(ctx)
    └─► (none/unknown) ──► interactive menu

Interactive Menu Loop:
    │
    ├─► checkRegistrationStatus() ──► fresh data
    ├─► ctx.ui.setWidget(status) ──► contextual status
    │      └─► ≤3 unregistered: show package names
    ├─► buildMenuOptions() ──► contextual labels
    │      └─► hasUnregistered? "🔧 Fix N packages" : "Find unregistered"
    ├─► ctx.ui.select(menu) ──► user choice
    │       │
    │       ▼
    │   handleChoice()
    │       │
    │       ▼
    │   execute action
    │       │
    │       ▼
    │   log result to transcript
    │
    ◄───── loop (refresh)
```

---

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| NPM list (cold) | ~500ms | Initial fetch |
| NPM list (cached) | ~1ms | Within 5s TTL |
| Settings read | ~5ms | Small JSON file |
| Gist sync | ~2s | Network dependent |
| Menu render | ~10ms | Local only |

---

## Security Boundaries

| Boundary | Enforcement |
|----------|-------------|
| Gist ID | Hexadecimal regex pattern |
| Backup path | Directory prefix matching |
| Shell execution | execAsync with timeouts |
| File reading | try/catch fallbacks |

---

*[← Back to Reference](./README.md)*

# Package Guard TUI UX Design Specification

## 1. Zone Architecture

```
┌─────────────────────────────────────────────────────┐
│ STATUS ZONE (Widget - Non-selectable)               │
│ 📦 12 pkgs │ 💾 backup.json │ ☁️ Gist: abc123...    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ CHAT TRANSCRIPT (Content - Historical)              │
│ > Previous actions and results appear here          │
│                                                     │
├─────────────────────────────────────────────────────┤
│ MENU ZONE (Chatbox - Navigable)                     │
│ ═══ Package Operations ═══                          │
│ > Find unregistered packages                            │
│   Save backup to file + Gist                        │
│   Restore packages from backup                      │
│                                                     │
│ ═══ Configuration ═══                               │
│   Change where backups are saved                    │
│   Set up new GitHub Gist backup                     │
│   [Contextual items appear based on state]          │
│                                                     │
│ ═══ System ═══                                      │
│   Show help                                         │
│   Exit                                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 2. Selection Scope Rules

### Non-Selectable (Display-Only)
- **Status Zone**: Package counts, backup path, Gist status
  - Implementation: `ctx.ui.setWidget()` - widget area is inherently non-selectable
  - Updates: Real-time on every menu loop iteration
  - Interaction: None (purely informational)

### Selectable (Navigable)
- **Menu Zone**: All menu items in `ctx.ui.select()` array
  - Section headers (═══ Name ═══) ARE selectable - serve as visual anchors
  - Empty strings create visual spacing
  - Keyboard: ↑↓ navigate, Enter confirm, Escape cancel

### Content Zone (Historical)
- **Chat Transcript**: Help text, notifications, action results
  - Implementation: `console.log()` for help, `ctx.ui.notify()` for ephemeral messages
  - Not interactive - historical record

## 3. Menu Hierarchy Design

### Anti-Pattern: Indentation for Grouping
```
❌ DON'T: Indentation creates navigation confusion
  Find unregistered packages
    Save backup
    Restore backup
  Change path       ← User thinks Tab key needed
    Create Gist
    Delete Gist
```

### Pattern: Section Headers with Visual Separation
```
✅ DO: Clear sections with separator lines
═══ Package Operations ═══
Find unregistered packages
Save backup to file + Gist
Restore packages from backup

═══ Configuration ═══
Change where backups are saved
Set up new GitHub Gist backup
Connect to existing Gist
[... state-dependent items]

════ System ═══
Show help
Exit
```

### Indentation Depth Rules
- **No indentation** for menu items - all at same level for consistent ↑↓ navigation
- **Section headers** centered with ═══ padding for visual distinction
- **Empty strings** (`""`) for vertical spacing between sections

## 4. Keyboard Navigation Patterns

| Key | Behavior | Scope |
|-----|----------|-------|
| ↑ / ↓ | Navigate through selectable menu items | Menu Zone only |
| Enter | Confirm selection | Menu Zone only |
| Escape / Ctrl+C | Cancel/Exit menu | Menu Zone only |
| Tab | N/A - not used | (No focusable inputs in menu) |

### Focus Indicators
- **Selected item**: Highlighted row with `>` cursor prefix (handled by pi's select UI)
- **Unselected items**: Plain text
- **Section headers**: Still selectable but styled as headers

## 5. Zone Transition Rules

```
User opens /package-guard
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  Status Widget  │◄────│  Menu Select UI  │
│  (always shown) │     │  (keyboard nav)  │
└─────────────────┘     └──────────────────┘
         │                       │
         │ User selects action   │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  Status Widget  │     │ Result displayed │
│  (updated)      │     │ in transcript    │
└─────────────────┘     └──────────────────┘
         │                       │
         └──────────┬──────────┘
                    │
         Menu reopens (loop continues)
```

### State Transitions
1. **Menu Open**: Status widget shows, menu select appears
2. **Item Selected**: Action executes, result logged to transcript
3. **Menu Refresh**: Status widget updates, menu reappears
4. **Exit**: Menu closes, widget clears (optional)

## 6. Layout Specifications

### Status Widget Format
```
📦 N │ status │ 💾 path │ ☁️ gistId ⏳on
```
- **Icons**: Single emoji prefix for quick visual scanning
- **Status segment**: `🔧 N` when packages need registering, `✓` when all ok
- **Path segment**: `local` (default) or `custom` (non-default path)
- **Gist segment**: `☁️ gistId ⏳on` when synced, `☁️ none ⏸️off` when disconnected
- **Delimiters**: `│` (box-drawing character) separates sections
- **Truncation**: Long gist IDs truncated with `...`
- **Layout**: Single line if possible, wrap to 2 lines if narrow terminal

### Menu Format
```typescript
const options = [
  "═══ Package Operations ═══",
  "🔧 Register N",
  "Backup",
  "Restore",
  "",
  "═══ Configuration ═══",
  "Change where backups are saved",
  // ... conditional items
  "",
  "═══ System ═══",
  "Show help",
  "Exit",
];
```

### Conditional Item Rules
- **Gist Create**: Show only when `!config.gistId && ghInstalled`
- **Gist Use**: Show only when `!config.gistId && ghInstalled`
- **Gist Change**: Show only when `config.gistId && ghInstalled`
- **Gist Delete**: Show only when `config.gistId && ghInstalled`
- **Toggle Sync**: Show only when `config.gistId` (disabled state shown in label)

## 7. Terminal Rendering Constraints

### Character Widths
- **Emojis**: Width 2 in most terminals - account for in truncation
- **Box drawing**: Width 1 - safe for all terminals
- **Unicode**: Avoid CJK, use basic emoji set only

### Color/Styling
- **Status widget**: Use `ctx.ui.setWidget()` default styling (neutral)
- **Menu headers**: No special styling - rely on ═══ pattern
- **Focus indicator**: Handled by pi's select UI

### Responsive Behavior
- **Width < 60**: Status widget wraps to 2 lines
- **Width < 40**: Status widget shows abbreviated form (icons only, hover for details)
- **Height < 15**: Menu scrolls with pagination

## 8. Implementation Notes

### API Usage
```typescript
// Status Zone - Non-selectable
ctx.ui.setWidget(STATUS_WIDGET_KEY, [
  `📦 ${registeredCount} │ 💾 ${filename} │ ☁️ ${gistStatus}`
]);

// Menu Zone - Selectable
const choice = await ctx.ui.select("Package Guard", menuOptions);

// Content Zone - Transcript
console.log("Help text appears in chat transcript");
ctx.ui.notify("Action completed", "info"); // Ephemeral overlay
```

### Key Design Decisions
1. **No disabled menu items**: All items are either shown or hidden
2. **Headers are selectable**: Cleaner than complex "disabled" logic
3. **Widget for status**: Enforces non-selectability at API level
4. **Empty string separators**: Visual grouping without state complexity

# Option C Layout Redesign — 2026-05-21

## Session Goal
Move the question from a full-width top bar into the left context panel so the right panel stays purely focused on user options. Change the default split from 50/50 to 70/30 (context/options).

## Original Problem
The question header spanned the entire top of the window, visually competing with the content below. Settings/help controls were in a global header bar. The right panel (options) still had its own internal question header, creating duplication when context was present.

## Key Decisions

### 1. Where to place the question
**Options considered:**
- **A:** Keep a thin global top bar, move question into left panel as a block
- **B:** Remove all top chrome, use a floating settings pill
- **C:** Question becomes a sticky block inside the left panel; settings/help live next to it

**Chosen:** Option C
**Why:** Unifies question and context visually. Settings stay discoverable (not hidden in a floating pill). Right panel is 100% focused on user action. No global chrome competes with content.

### 2. Default panel split
**Before:** 50/50
**After:** 70/30 (context / options)
**Why:** Context is usually long markdown with mermaid diagrams. 50% often felt cramped. 30% is enough for 3-5 options with descriptions.

### 3. MIN_PANEL_WIDTH raised from 20% → 25%
**Discovered during review:** The SettingsButton dropdown is 208px wide (`w-52`). At 20% panel width on a 1000px window, the left panel is only 200px. The dropdown would clip at the panel boundary.

**Fix:** `MIN_PANEL_WIDTH = 25` gives 250px minimum, leaving ~40px padding for the 208px dropdown.

### 4. Component extraction for dual-mode reuse
`SettingsButton` and `HelpIcon` were duplicated between `HeaderBar` (no-context mode) and `ContextPanel` (split mode). Extracted both to shared locations:
- `SettingsButton.tsx` — new component with dropdown logic
- `HelpIcon` → `icons.tsx`

This prevents drift when the icon design changes.

## Dead Code Found & Removed

The question components (`SingleSelect`, `MultiSelect`, `Freeform`, `Questionnaire`) had dual-mode code:
```tsx
{showHeader && (
  <div>
    <h1>{payload.question}</h1>
    {payload.context && <p>{payload.context}</p>}
  </div>
)}
```

This was **never rendered** in practice:
- Context mode: `renderComponent(payload, false)` — `showHeader=false`
- No-context mode: `showHeader` was also false (passed from `renderComponent`)

Removing it simplified every component's props API by one boolean.

## Simplifications Applied

| Before | After | Why |
|--------|-------|-----|
| `handleMouseDown` wrapper function | Inlined `setIsDragging(true)` | 1-line wrapper adds no abstraction |
| `hasResults` variable | `filtered.length > 0` inline | Used once, unnecessary indirection |
| `selectAllOpt` | `selectAllOption` | Full word is clearer |
| Decorative `/* ── Refs for stable keydown handler ── */` | Removed | Restates obvious code |
| Inline 6-line SVG in `Questionnaire` | `import { CommentIcon }` | DRY, shared icon file |

## Documentation Updated

- **This journal** — `packages/pi-ask-user-glimpse/docs/session/2026-05-21-option-c-layout.md`
- **CHANGELOG.md** — entry for v0.4.2 (when released)
- **Memex card** — `glimpse-ask-user-layout-patterns` (shared insights across projects)

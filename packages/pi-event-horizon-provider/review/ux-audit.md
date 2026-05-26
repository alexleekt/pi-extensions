# UX Audit: `/event-horizon` Command

**Package:** `pi-event-horizon-provider`  
**File:** `packages/pi-event-horizon-provider/index.ts`  
**Date:** 2026-05-25  
**Auditor:** Review subagent  
**Scope:** User experience, visual design, information hierarchy, accessibility, consistency with Pi ecosystem patterns.

---

## Critical Finding: Implementation Mismatch

**Current `main` branch code uses `ctx.ui.notify()`, not `ctx.ui.setWidget()`.**

The command handler at lines 315–361 renders the status as a one-shot notification toast (`ctx.ui.notify(lines.join("\n"), "info")`). It is fully blocking: the user sees nothing until all health checks complete.

An unmerged branch (`event-horizon-async-status`, commit `ac660860`) contains the live-updating `setWidget()` implementation described in ADR-0001 (`docs/adr/0001-async-status-widget.md`). The audit below evaluates **both** the current shipping UX (notify-based) and the proposed widget UX (branch-based), since the questions explicitly reference widget behavior.

---

## 1. Widget Line Format & Terminal Width

### Current (notify-based)
- **Format:** `  ● {paddedName}  online  → {targetModel}  ${input}/${output} per 1M  (cache: ${cacheRead}/${cacheWrite})`
- **Readability:** Moderate. Name padding aligns instance names, but the entire line is monolithic and can overflow typical terminals.
- **Width risk:** With a typical LiteLLM target model name (`anthropic/claude-sonnet-4-20250514`) plus cost annotations, the line exceeds **110 columns**. On an 80×24 terminal this wraps messily. No truncation strategy exists.

### Proposed (widget branch)
- Same format, same width risk. Because the widget lives above the editor, wrapped lines push the editor down dynamically, causing visual jitter as rows update from "checking..." → "online".
- **Recommendation:** Introduce a max-width guard. Truncate `targetModel` to ~20 chars with ellipsis, or move cost/cache details to a second line that only appears on wider terminals (>100 cols).

---

## 2. Color Choices (Success / Error / Dim / Warning)

### Current
- **Online:** `theme.fg("success", "●")` + `theme.fg("success", "online")` — green.
- **Offline:** `theme.fg("error", "●")` + `theme.fg("error", "offline")` — red.
- **Errors:** `theme.fg("warning", r.error)` — yellow/orange.
- **Dim:** `theme.fg("dim", "unknown target")` — grey.

### Proposed (widget branch)
- **Checking:** `theme.fg("dim", "●")` + `theme.fg("dim", "checking...")` — grey.  
- **Unknown target:** `theme.fg("dim", "?")` — grey. This is a regression in informativeness vs. main ("unknown target" → "?").

### Accessibility
- The bullet symbol `●` is identical for all three states; only its ANSI color changes. **Colorblind users cannot distinguish online/offline/checking by shape.**
- Pi-heading solves this by using **different glyphs** per phase: `▸` (goal), `⠋` (working), `✓` (achievement). Each has a distinct shape *and* semantic color.
- **Recommendation:** Adopt shape-differentiated bullets:  
  - Online: `●` or `▸`  
  - Offline: `✗` or `○`  
  - Checking: `⠋` (Braille spinner) or `⋯`

---

## 3. Header Line Separator & Visual Structure

### Current
```
Event Horizon Instances

  ● local    online  → claude-sonnet-4  $3/$15 per 1M  (cache: $0.3/$3.75)
```
- Header is `theme.bold("Event Horizon Instances")` with a blank line below.
- No horizontal rule, no border, no section delimiter.

### Proposed
- Identical header structure.

### Ecosystem comparison
- **pi-pkg-guard** uses `═══ Section Name ═══` centered box-drawing headers inside `ctx.ui.select()` menus.
- **pi-heading** intentionally uses *no* header at all — just a single plain-text line (ADR-0001 anti-ghosting principle).
- **pi-worktrunk-signal** previously used a bordered footer widget and **removed it** because border fragments caused ghosting in scrollback (CHANGELOG v0.2.0).

### Recommendation
- For a multi-line widget, a lightweight separator improves scannability without ghosting risk.  
  Suggestion: `theme.fg("dim", "─".repeat(terminalWidth))` as the second line, or simply keep the blank line as-is.  
- Do **not** use box-drawing borders (`┌─┐│`) inside a widget — this violates the anti-ghosting convention established by pi-heading and pi-worktrunk-signal.

---

## 4. "checking..." Clarity vs. Spinner Animation

### Current
- No intermediate state; user waits in silence until all checks finish.

### Proposed
- Static `checking...` in dim grey. It communicates intent clearly but feels "dead" — the same criticism that prompted pi-heading ADR-0002 ("static one-line widget feels dead").

### Ecosystem comparison
- **pi-heading** uses a Braille spinner (`⠋⠙⠹⠸⠼⠴⠦⠧`) rotating every 120 ms. It signals liveness without ghosting because it's pure character rotation on a single line.
- **pi-pkg-guard** uses `ctx.ui.setWorkingMessage("Scanning...")` for transient work, which appears in Pi's native status area, not the widget zone.

### Recommendation
- Replace static `checking...` with a **Braille prefix** on the checking rows: `⠋ local  checking...`  
- This is consistent with pi-heading, costs zero extra dependencies, and carries no ghosting risk (no borders, no components).
- For accessibility, the static word "checking..." should remain adjacent to the spinner so screen readers have text to announce.

---

## 5. Cost Display Format ($3/$15 per 1M)

### Current & Proposed
```
$3/$15 per 1M  (cache: $0.3/$3.75)
```

### Issues
1. **Ambiguity:** "per 1M" is not self-explanatory to new users. Per 1M *what*? Tokens? Characters? Requests?
2. **Unlabeled ordering:** The first number is input cost, the second is output cost, but this is learned convention. A user glancing quickly may misread.
3. **Inconsistent precision:** `$0.3` (one decimal) vs `$3.75` (two decimals). Formatting should be uniform, e.g. `$0.30`.
4. **Cache cost obscurity:** "cache: $0.3/$3.75" is even more cryptic. Cache read vs. cache write is not labeled.

### Recommendation
- Short form (≤80 cols): `$3.00 in / $15.00 out per 1M tokens`  
- Cache form: `cache read $0.30 / write $3.75`  
- Or adopt a **tabular two-line format** when width permits:
  ```
  local → claude-sonnet-4      $3.00 / $15.00 per 1M tokens
                                cache $0.30 / $3.75
  ```

---

## 6. Widget Competing with Other UI Elements

### Current (notify)
- Toast appears as an ephemeral overlay. It does not compete for permanent screen real estate, but it **does block** the command until completion and disappears automatically.

### Proposed (widget branch)
- The widget is placed `aboveEditor` and is **multi-line** (header + blank + N instances + blank + footer + config path).
  - 1 instance ≈ 6 lines
  - 3 instances ≈ 9 lines
  - 5 instances ≈ 13 lines
- This is **the tallest widget in the entire Pi ecosystem**. Pi-heading uses 1 line. pi-pkg-guard status widget is 1 line. pi-worktrunk-signal removed its multi-line footer for being duplicative.
- A persistent 9-line widget above the editor **significantly reduces visible chat transcript** and pushes the editor downward.

### Recommendation
- If `setWidget()` is adopted, **cap the widget at 3–4 lines** for typical usage:
  - Line 1: Header + summary (`Event Horizon — 2/3 online`)
  - Line 2–N: Instance rows (max 2–3 visible; truncate or abbreviate if more)
  - Consider moving config-path footnote into a **notification** after checks complete, or omitting it entirely from the widget surface.
- Alternatively, keep the full detail in the **notification** (current behavior) and use the widget only for a **compact live summary** (1–2 lines) while checks run.

---

## 7. Should the URL Accompany the Instance Name?

### Current & Proposed
- Only the YAML key name is shown (e.g., `local`, `staging`, `prod`). The URL is hidden.

### Analysis
- **Pros of hiding URL:** Keeps lines short. Instance names are usually mnemonic.
- **Cons of hiding URL:** When debugging a failed instance, the user must open `instances.yaml` to see which URL is actually failing. The error message (`HTTP 404`, `ECONNREFUSED`) lacks context.
- **Ecosystem comparison:** pi-pkg-guard shows the backup file path in its status widget (`💾 path`). pi-worktrunk-signal showed branch names. URLs are arguably more diagnostic than paths.

### Recommendation
- Show the **hostname:port** (not full URL) for offline or errored instances:
  ```
  ● local (localhost:4000)  offline → LiteLLM: timeout
  ```
- For online instances, the target model name (`→ claude-sonnet-4`) is more useful than the proxy URL, so keep current behavior there.

---

## 8. Placement: `aboveEditor` vs. `belowEditor`

### Proposed
- The branch explicitly passes `{ placement: "aboveEditor" }`.

### Ecosystem comparison
- **No other extension in the monorepo** passes a `placement` option to `setWidget()`. Pi-heading and pi-pkg-guard rely on the default placement.
- Pi-heading's widget appears above the editor by default (inferred from its visibility during agent execution).
- `aboveEditor` is sensible for a command the user just invoked — it places results in the user's immediate focus.
- `belowEditor` would place the widget between the input box and the bottom status bar. This is less visible and would feel "buried" for a status command.

### Recommendation
- `aboveEditor` is the **correct choice** for an active status command.  
- However, **omit the explicit `placement` option** unless the API requires it. The default is already `aboveEditor`, and being explicit introduces an unnecessary divergence from every other extension in the repo. If the default ever changes, it's better to change globally than to have one outlier.

---

## 9. Comparison with Other `setWidget()` Conventions

| Extension | Widget Key | Lines | Content | Clear Behavior | Components |
|-----------|------------|-------|---------|----------------|------------|
| **pi-heading** | `pi-heading` | 1 | Plain text with prefix (`▸`, `⠋`, `✓`) | Cleared on `session_shutdown` or idle | ❌ None |
| **pi-pkg-guard** | `pi-pkg-guard:status`, `pi-pkg-guard:gist` | 1 | Emoji + stats with `│` delimiters | Cleared on menu exit / Escape | ❌ None |
| **pi-worktrunk-signal** *(removed)* | — | 2–3 | Branch + emoji + ahead/behind | — | ❌ None (plain text) |
| **pi-event-horizon (branch)** | `event-horizon` | 6–13 | Multi-line table with bold headers, colors, cost | **Never clears** | ❌ None |

### Deviations from convention
1. **Widget key not namespaced:** Pi-heading uses `pi-heading`; pi-pkg-guard uses `pi-pkg-guard:*`. The branch uses bare `event-horizon`. Recommendation: `pi-event-horizon:status`.
2. **Multi-line widget:** The ecosystem consensus is **1 line maximum** for widgets to avoid scrollback pollution and editor displacement. The branch is 6× taller than the tallest accepted widget.
3. **No auto-clear:** Every other widget has a deterministic clear path (session end, menu exit, idle state). The branch persists forever. This risks "widget fatigue" — the user sees Event Horizon status long after they care.
4. **No `try/finally` guard:** ADR-0001 explicitly recommends `try/finally` to guarantee `setWidget(key, undefined)`. The branch lacks this; a thrown exception leaves the widget stuck in "checking..." state.

---

## Summary of Recommendations (Priority Order)

| Priority | Item | Action |
|----------|------|--------|
| **P0 — Blocker** | Implementation mismatch | Decide whether `main` should merge the `event-horizon-async-status` branch **or** update the ADR to reflect the current `notify()` reality. Shipping code that contradicts its own ADR is a documentation bug. |
| **P1 — Blocker** | Widget never clears | Add `try/finally` + `setWidget(key, undefined)` in the branch. If staying on `notify()`, this is moot. |
| **P2 — High** | Widget height | Reduce widget to ≤3 lines (header + 1–2 instance rows, or a single summary line). Move full detail to a notification or to a `/event-horizon-detail` command. |
| **P2 — High** | Terminal width overflow | Truncate `targetModel` to 18 chars. Abbreviate cost to `$3/$15/1M tk`. Consider two-line rows only when `terminalWidth > 100`. |
| **P3 — Medium** | Color accessibility | Use distinct glyphs per state (`✓`, `✗`, `⠋`) in addition to color. Do not rely on `●` color alone. |
| **P3 — Medium** | Cost clarity | Label input vs. output explicitly: `$3 in / $15 out per 1M tokens`. |
| **P3 — Medium** | Spinner vs. static text | Replace `checking...` with a Braille spinner + text: `⠋ local  checking...`. |
| **P4 — Low** | Widget key | Rename to `pi-event-horizon:status` for consistency. |
| **P4 — Low** | Placement option | Remove explicit `{ placement: "aboveEditor" }`; rely on default. |
| **P4 — Low** | URL display | Append `(host:port)` only for offline/errored instances. |

---

## Artifacts Consulted

- `packages/pi-event-horizon-provider/index.ts` (current `main`, notify-based)
- `packages/pi-event-horizon-provider/docs/adr/0001-async-status-widget.md`
- `packages/pi-event-horizon-provider/index.ts` from branch `event-horizon-async-status` (commit `ac660860`)
- `packages/pi-heading/ui/widget.ts` & `docs/adr/0001-anti-ghosting-widget.md`
- `packages/pi-pkg-guard/docs/epics/epic-05-ux/UX_DESIGN_SPEC.md`
- `packages/pi-pkg-guard/extensions/index.ts` (setWidget usage)
- `packages/pi-worktrunk-signal/CHANGELOG.md` (footer widget removal rationale)

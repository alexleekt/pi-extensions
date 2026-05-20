# ADR 0001: Anti-Ghosting Widget — No Borders, No Components

## Status
Accepted

## Context
The existing `pi-recap` (by @Fornace, MIT licensed) renders a bordered `StatusWidget` above the editor using pi-tui's `Box`, `Container`, and custom animation timers. Users report severe visual artifacts — orphaned border characters (`│`, `─`, `┐`) accumulate in the terminal scrollback buffer because pi-tui's differential renderer only overwrites "changed" lines, and border fragments from previous frames fall outside that window. The author added a "decoy row" hack (bumping an extra row on Enter keypress) as a best-effort mitigation, but it does not catch all redraw paths.

## Decision
Render the heading as a **single plain-text line** via `ctx.ui.setWidget()` with a string array. Do not use any pi-tui component (`Box`, `Container`, `Text`, custom component object). Do not draw borders, background colors, or multi-line panels.

## Consequences

- **Positive:** Zero ghosting risk. A one-line string has no border fragments to orphan. pi-tui's differential renderer naturally overwrites it in place.
- **Positive:** Drastically simpler code. No animation timers, no `invalidate()` caches, no `pauseRendering()` races.
- **Positive:** No keyboard focus or hotkey management. The widget is purely passive.
- **Negative:** No visual "panel" affordance. The goal line blends into the terminal output rather than looking like a distinct UI element.
- **Negative:** No inline animations (breathing dot, settle sweep). The line is static text.

## Prompt File Format

Each prompt file is a markdown file with YAML frontmatter:

```yaml
---
max_words: 4
---
Summarize this user message as a concise topic. Use the user's exact terminology.

Message: {message}
```

The `max_words` field is read by the extension and injected into the prompt as a hard constraint. Post-generation, the output is truncated to the nearest word boundary if the LLM exceeds the limit.

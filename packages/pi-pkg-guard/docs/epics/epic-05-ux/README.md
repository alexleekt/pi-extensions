# Epic 5: User Experience

> UI/UX, i18n, and help features
> 
**Status:** Implemented  
**Target Release:** v0.4.0

---

## Overview

This epic covers the user experience features including the interactive menu interface, contextual help, and internationalization support.

## User Stories

| Story | Description | Status |
|-------|-------------|--------|
| [5.1](./user-stories.md#story-51-interactive-menu-interface) | Interactive Menu Interface | ✅ Implemented |
| [5.2](./user-stories.md#story-52-contextual-help) | Contextual Help | ✅ Implemented |
| [5.3](./user-stories.md#story-53-internationalization-i18n) | Internationalization (i18n) | ✅ Implemented |

## Features

### Interactive Menu
- Zone-based UI architecture
- Section headers with visual separation
- Contextual items based on state
- Keyboard navigation (↑↓, Enter, Escape)

### Contextual Help
- In-app help documentation
- Non-blocking display
- Fully internationalized

### Internationalization
- ICU MessageFormat support
- Pluralization handling
- Locale auto-detection
- English fallback

## Technical Summary

| Component | Implementation |
|-----------|----------------|
| Zone Architecture | Widget (non-selectable) + Menu (selectable) |
| Keyboard | ↑↓ navigate, Enter confirm, Escape cancel |
| i18n Engine | Custom ICU MessageFormat parser |
| Fallback | English (en-US) default |

## Documents

- [UX Design Specification](./UX_DESIGN_SPEC.md) - TUI zone architecture & design patterns
- [acceptance-criteria/](./acceptance-criteria/) - Gherkin feature files

---

*[← Back to Documentation](../../README.md)*

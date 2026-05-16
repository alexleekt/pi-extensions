# Epic 2: Package Management

> Manual scan and selective restore features
> 
**Status:** Implemented  
**Target Release:** v0.2.0

---

## Overview

This epic covers the interactive package management features that allow users to scan for unregistered packages and selectively restore packages from backups.

## User Stories

| Story | Description | Status |
|-------|-------------|--------|
| [2.1](./user-stories.md#story-21-manual-unregistered-scan) | Manual Unregistered Scan | ✅ Implemented |
| [2.2](./user-stories.md#story-22-selective-package-restore) | Selective Package Restore | ✅ Implemented |

## Features

### Manual Scan
- Triggered via `/package-guard` menu
- Automatically registers unregistered packages
- Shows reload hint after registration

### Selective Restore
- Interactive selection of packages to restore
- Bulk options: Include All, Skip All
- Generates install command hint

## Technical Summary

| Component | Implementation |
|-----------|----------------|
| Registration Format | `npm:` prefix (`npm:pi-foo`) |
| Backup Sources | Local file, GitHub Gist |
| Selection UI | Sequential prompts with while-loop |
| Deduplication | Graceful handling of existing packages |

## Acceptance Criteria

See [acceptance-criteria/](./acceptance-criteria/) for Gherkin feature files.

---

*[← Back to Documentation](../../README.md)*

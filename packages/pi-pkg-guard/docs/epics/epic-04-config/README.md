# Epic 4: Configuration

> Settings persistence and customization features
> 
**Status:** Implemented  
**Target Release:** v0.3.0

---

## Overview

This epic covers the configuration management features that allow users to customize backup paths and persist settings across sessions.

## User Stories

| Story | Description | Status |
|-------|-------------|--------|
| [4.1](./user-stories.md#story-41-custom-backup-path) | Custom Backup Path | ✅ Implemented |
| [4.2](./user-stories.md#story-42-configuration-persistence) | Configuration Persistence | ✅ Implemented |

## Features

### Custom Backup Path
- Configurable within `~/.pi/agent/` or temp directories
- Path expansion (`~` → `$HOME`)
- Security validation prevents path traversal

### Settings Persistence
- Stored in `~/.pi/agent/settings.json`
- Type-safe with runtime validation
- Graceful degradation on invalid config

## Technical Summary

| Component | Implementation |
|-----------|----------------|
| Storage Location | `~/.pi/agent/settings.json` |
| Config Key | `pi-pkg-guard` |
| Validation | Type guards (`isExtensionSettings()`) |
| Allowed Paths | `~/.pi/agent/` and temp directories |

## Acceptance Criteria

See [acceptance-criteria/](./acceptance-criteria/) for Gherkin feature files.

---

*[← Back to Documentation](../../README.md)*

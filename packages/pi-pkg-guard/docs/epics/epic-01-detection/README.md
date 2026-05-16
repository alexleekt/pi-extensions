# Epic 1: Detection & Prevention

> Unregistered package detection and prevention features
> 
**Status:** Implemented  
**Target Release:** v0.1.0

---

## Overview

This epic covers the core detection and prevention mechanisms that identify unregistered pi packages and warn users before they create new unregistered packages.

## User Stories

| Story | Description | Status |
|-------|-------------|--------|
| [1.1](./user-stories.md#story-11-unregistered-detection-on-startup) | Unregistered Detection on Startup | ✅ Implemented |
| [1.2](./user-stories.md#story-12-npm-install-interception) | NPM Install Interception | ✅ Implemented |

## Features

### Startup Detection
- Runs automatically when pi starts
- Debounced to once per hour to avoid excessive npm calls
- Displays warning in status area if unregistered packages detected

### NPM Guard
- Intercepts `npm install -g pi-*` commands
- Warns user to use `pi install npm:*` instead
- Non-blocking - doesn't prevent command execution

## Technical Summary

| Component | Implementation |
|-----------|----------------|
| Detection Pattern | `/^pi-\|-pi$|\/pi-/` + keywords |
| Keywords | `pi-coding-agent`, `pi-extension`, `pi-package` |
| NPM Cache TTL | 5000ms (5 seconds) |
| Exclusions | Core package, dev mode packages |

## Acceptance Criteria

See [acceptance-criteria/](./acceptance-criteria/) for Gherkin feature files.

---

*[← Back to Documentation](../../README.md)*

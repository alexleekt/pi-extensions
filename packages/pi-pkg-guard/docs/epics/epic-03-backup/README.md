# Epic 3: Backup & Recovery

> Local and cloud backup features
> 
**Status:** Implemented  
**Target Release:** v0.3.0

---

## Overview

This epic covers the backup and recovery mechanisms that allow users to save their package configuration locally and sync to GitHub Gist.

## User Stories

| Story | Description | Status |
|-------|-------------|--------|
| [3.1](./user-stories.md#story-31-local-package-backup) | Local Package Backup | ✅ Implemented |
| [3.2](./user-stories.md#story-32-github-gist-cloud-backup) | GitHub Gist Cloud Backup | ✅ Implemented |

## Features

### Local Backup
- Saves to `~/.pi/agent/package-guard-backup.json`
- Customizable path within allowed directories
- Human-readable JSON format

### GitHub Gist Backup
- Syncs to public GitHub Gist
- Requires GitHub CLI (`gh`)
- Gist backup sync toggle

## Technical Summary

| Component | Implementation |
|-----------|----------------|
| Default Path | `~/.pi/agent/package-guard-backup.json` |
| Gist ID Validation | Hexadecimal-only (`/^[a-f0-9]{32,}$/i`) |
| Security | Path traversal prevention |
| Format | JSON with 2-space indentation |

## Acceptance Criteria

See [acceptance-criteria/](./acceptance-criteria/) for Gherkin feature files.

---

*[← Back to Documentation](../../README.md)*

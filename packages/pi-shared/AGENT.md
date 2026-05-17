---
parent: ../../AGENT.md
---

# AGENT.md — @alexleekt/pi-shared

## Monorepo Context

This package lives inside the `pi-extensions` monorepo. See [`../../AGENT.md`](../../AGENT.md) for monorepo-wide conventions (shared tooling, just commands, release process, CI setup).

## Purpose

Shared types and utilities for Pi extensions in this monorepo.

## Exports

| Path | Description |
|------|-------------|
| `@alexleekt/pi-shared/session` | `manageSessionSubscription()` — per-session subscription lifecycle helper |
| `@alexleekt/pi-shared/types` | Shared Pi extension type definitions |

## Conventions

- **TypeScript only** — no runtime build step, Pi loads `.ts` directly
- `tsconfig.json` extends `../tsconfig.base.json`
- `typecheck` script runs `tsc --noEmit`
- No tests in this package (tested indirectly via dependent extensions)
- Keep surface area small — this is a shared library, not a feature dump

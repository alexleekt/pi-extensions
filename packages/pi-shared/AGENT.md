---
parent: ../../AGENT.md
---

# AGENT.md — @alexleekt/pi-shared

> Behavioral rules for AI agents working on this codebase.

## Monorepo Context

This package lives inside the `pi-extensions` monorepo. See [`../../AGENT.md`](../../AGENT.md) for monorepo-wide conventions.

## Invariants (Never Break These)

1. **TypeScript only** — no runtime build step. Pi loads `.ts` files directly.
2. **Small surface area** — This is a shared library, not a feature dump. Keep exports minimal and focused.
3. **TestCase generic constraint** — All `TestCase` subtypes must declare `[key: string]: unknown` to satisfy the generic constraint.
4. **Pure scorers** — New scorers must be pure functions returning `ScoreResult`. No side effects.

## Extension-Specific Rules

- `tsconfig.json` extends `../tsconfig.base.json`
- `typecheck` script runs `tsc --noEmit`
- No tests in this package (tested indirectly via dependent extensions)
- Keep peer dependencies minimal — only `@earendil-works/pi-coding-agent` where needed

## Decision Making

| Scenario | Action |
|----------|--------|
| Adding new exports | Ask first — consider if it belongs in a specific package instead |
| Modifying existing scorers | Proceed, verify via dependent extension tests |
| Bug fixes with clear solution | Proceed |

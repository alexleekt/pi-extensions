# AGENT.md — @alexleekt/pi-extensions

> Behavioral rules for AI agents working on this monorepo.

## Communication Style

- Be direct and to the point
- Ask clarifying questions when requirements are unclear
- Flag security implications immediately

## Working in This Monorepo

- Keep changes scoped to the package you're working on
- Never mix unrelated changes in a single commit
- Use isolated worktrees (e.g. `git worktree`) when available to prevent clobbering work on other packages

## Package-Level Isolation

Each package has its own `AGENT.md` with package-specific rules. When working on a package, the **package AGENT.md is authoritative** — it overrides the root AGENT.md if they conflict.

| Package | AGENT.md | Key concerns |
|---------|----------|-------------|
| `pi-ask-user-glimpse` | `packages/pi-ask-user-glimpse/AGENT.md` | Webview HTML, XSS, Glimpse sandbox |
| `pi-heading` | `packages/pi-heading/AGENT.md` | Widget rendering, prompt evaluation |
| `pi-shared` | `packages/pi-shared/AGENT.md` | Shared scorer library, minimal surface |
| `pi-bump` | `packages/pi-bump/AGENT.md` | (existing) |
| `pi-pkg-guard` | `packages/pi-pkg-guard/AGENT.md` | (existing) |
| `pi-worktrunk-signal` | `packages/pi-worktrunk-signal/AGENT.md` | (existing) |

### Shared Package (pi-shared)

`pi-shared` is a shared library used by other packages. Changes to `pi-shared` may require verification in **dependent packages** (e.g., `pi-heading`). When modifying `pi-shared`:

1. Run `npm run typecheck` in `pi-shared`
2. Run tests in the packages that import `pi-shared` to catch regressions
3. Never add package-specific logic to `pi-shared` — it belongs in the consumer package

### Root files (no per-package scope)

Some files at the root level are shared across all packages:

| Root file | Purpose | Isolation rule |
|-----------|---------|---------------|
| `package.json` (workspace root) | Workspace metadata, shared scripts | Changes affect all packages — ask first |
| `tsconfig.base.json` | Base TypeScript config | Changes affect all packages — ask first |
| `biome.json` | Linting rules | Changes affect all packages — ask first |
| `justfile` | Task automation | Changes affect all packages — ask first |
| `PUBLISH.md` | Release workflow | Package-specific release instructions live in each package's `AGENT.md` |

### Package-specific rules

Package-specific behavioral rules (e.g., "Never use `setTimeout` in this package's factory") belong in the **package's own `AGENT.md`**, not in this root file. The root file only covers:

- Monorepo-wide conventions (all packages share these)
- Cross-cutting concerns (shared tooling, CI, release workflow)
- References to package-level docs

## Dependency Hygiene

The workspace `package-lock.json` resolves `@earendil-works/pi-coding-agent` because all packages declare it as a peer dependency. npm auto-installs peer deps, so the lockfile hard-pins the resolved version.

**Keep it current.** When working in this monorepo:

1. **Check the latest version:** `npm view @earendil-works/pi-coding-agent version`
2. **Check the lockfile version:** `grep -A2 '"node_modules/@earendil-works/pi-coding-agent"' package-lock.json`
3. **If behind, bump before building:** `npm update @earendil-works/pi-coding-agent`
4. **Verify the build still passes** after updating — extension API surface may have changed

**Why:** A stale lockfile (e.g., 0.75.4 while latest is 0.78.1) means you build and test against old types, but users may run on newer Pi versions with new/deprecated APIs. This creates hidden drift.

## Before Committing

1. Run `npm run typecheck` in the affected package
2. Run `just lint` or `npx @biomejs/biome check` for the affected files
3. Run `npm test` if the package has tests
4. **If you changed webview code** (`webview/src/`), run `npm run build` in the affected package to regenerate `dist/index.html`
5. **Validate agent configs** — Run `agnix validate .` after modifying any `AGENT.md`, `AGENTS.md`, `claude.md`, or `SKILL.md` file. This validates skills, MCP servers, hooks, memory, and plugins across Claude Code, Cursor, Codex, and Kiro targets.
6. Review `PUBLISH.md` before any release-related changes

## Build Artifacts (Runtime-Critical)

Package-specific build artifact rules are documented in each package's `AGENT.md`. For `pi-ask-user-glimpse` webview builds, see `packages/pi-ask-user-glimpse/AGENT.md`.

### General rules
- `dist/` is gitignored — it can disappear after `git clean`, fresh clones, or switching worktrees
- **When starting work** on a package with a webview, verify the artifact exists: `ls dist/`
- **If missing, rebuild immediately** before testing the extension: `npm run build`
- `npm run build` is safe to run repeatedly — Vite's `emptyOutDir: true` handles cleanup

## Design Journals (Required)

After any significant session (>30 min or touching architecture), write a design journal:

```
packages/<pkg>/docs/session/YYYY-MM-DD-title.md
```

**Trigger:** Write one when you made a non-obvious decision, found a surprising bug, or reversed a prior decision.

**Template:** See `docs/session/JOURNAL_CONVENTION.md`. At minimum include:
1. Session goal
2. Original problem
3. Key decisions with options considered
4. Bugs found — symptom, root cause, fix, prevention
5. Documentation updated

**Relationship to other docs:**
- **ADR** (`docs/adr/`) — one hard decision → one ADR
- **CONTEXT.md** — glossary terms resolved during the session
- **AGENT.md** — invariants that changed
- **Memex card** — atomic insight saved via `memex_retro`

Use the quest log as the journal outline. Use vent entries for the "prevention" section.

## Code Conventions

- TypeScript only — Pi loads `.ts` files directly
- Use `.js` extensions on relative imports (NodeNext module resolution)
- All packages extend `packages/tsconfig.base.json`
- Every package has a `typecheck` script (`tsc --noEmit`)
- `check` as backward-compatible alias where needed

## Decision Making

| Scenario | Action |
|----------|--------|
| Adding new dependencies | Ask first |
| Changing shared tooling (root biome, tsconfig, justfile) | Ask first |
| Modifying core detection logic in any package | Ask first |
| Refactoring type guards or tests | Proceed, then verify tests pass |
| Adding tests | Proceed |
| Documentation updates | Proceed |
| Bug fixes with clear solution | Proceed |

## Invariants (Never Break These)

- No per-package `package-lock.json` — root lockfile only
- No per-package `.github/workflows/` — CI lives at root
- Release tags: always scoped (`@alexleekt/pi-bump@0.3.0`), never bare `v0.3.0`
- Biome checks extension code only — webviews have their own build toolchains and are excluded

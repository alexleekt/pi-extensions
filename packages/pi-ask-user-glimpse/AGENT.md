---
parent: ../../AGENT.md
---

# AGENT.md — pi-ask-user-glimpse

> Behavioral rules for AI agents working on this codebase.

## Monorepo Context

This package lives inside the `pi-extensions` monorepo. See [`../../AGENT.md`](../../AGENT.md) for monorepo-wide conventions.

> This file is authoritative for this repository. If it conflicts with general agent guidelines, this file wins.

## Invariants (Never Break These)

1. **Self-contained bundle** — `dist/index.html` must have zero external network requests. All JS, CSS, and assets inlined.
2. **Payload injection contract** — The `/*ASK_USER_PAYLOAD*/` placeholder replacement MUST escape `<`, `>`, and `&` as `\u003c`, `\u003e`, `\u0026` to prevent HTML injection.
3. **Fast-escape on UI failure** — If `glimpseui.prompt()` throws and no UI is available, return an explicit error telling the agent to ask in free-form text. Never crash Pi.
4. **No setTimeout in extension factory** — The factory function must never use `setTimeout`, `setImmediate`, or deferred callbacks. Unhandled errors in deferred callbacks crash Pi.
5. **`noEmit` tsconfig** — Pi loads `.ts` files directly. Do NOT add `outDir` or `declaration` settings.

## Critical Rules

### HTML escaping
Test scripts must use the **same escaping** as production code in `tool/ask-user.ts`. Add new escapes to both production and all test scripts.

### XSS prevention
`highlightMatch()` must escape BOTH display text and query before producing HTML. Never use raw `.replace()` with user input into `dangerouslySetInnerHTML`.

### Sanitizer audits
When adding new rich content support (video, audio, etc.), audit `sanitizeHtml()` first. It blocks `script`, `img`, `iframe`, `object`, `embed`, `form`, `svg`, and strips `javascript:` / `data:` URLs.

### MultiSelect submit
The submit handler must block when `selected.size === 0`. The search `query` is NOT a valid submission.

### No defensive code for dead paths
The server never sends a `questionnaire` without `questions`. Don't add defensive code for unreachable states.

## Extension-Specific Rules

- **Indentation:** 2 spaces (TypeScript)
- **Imports:** Use `.js` extensions on relative imports (NodeNext module resolution)
- **Console output:** Use `[pi-ask-user-glimpse]` prefix for all `console.warn`/`console.error`
- **Peer deps:** List `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` in `peerDependencies`. Do NOT add `@earendil-works/pi-tui` — it's not used.

## Decision Making

| Scenario | Action |
|----------|--------|
| Adding new webview dependencies | Ask first |
| Modifying HTML escaping logic | Proceed with extreme caution — test scripts must match |
| Adding new rich content types | Proceed, but audit sanitizer first |
| Refactoring component state | Proceed, verify with `npm run validate` |
| Bug fixes with clear solution | Proceed |

## Deferred Work (Do Not Touch Without Discussion)

- Centralizing keyboard listeners from components into `App.tsx` or a provider context
- Custom window icons in glimpseui (API does not exist in v0.8.1)

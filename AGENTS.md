# AGENTS.md — pi-ask-user-glimpse

> Project-specific guidelines for AI agents working on this codebase.
> This file is authoritative for this repository. If it conflicts with general agent guidelines, this file wins.

## What This Project Is

A **Pi extension** that replaces the built-in `ask_user` tool with rich native WebView dialogs powered by [`glimpseui`](https://npmjs.com/package/glimpseui). The webview is a React + Tailwind app bundled as a single inlined HTML file (`dist/index.html`).

**Repository:** `alexleekt/pi-ask-user-glimpse`  
**Published as:** `@alexleekt/pi-ask-user-glimpse` on npm

## Architecture

```
index.ts              → Extension entrypoint (registers tool + slash command)
tool/ask-user.ts      → Payload construction, HTML injection, glimpseui.prompt() call
tool/response-formatter.ts → Normalizes webview response → Pi AgentToolResult
util/detect-conflict.ts    → Warns if competing ask_user tools are loaded
util/safe-callback.ts      → Error-swallowing wrapper for deferred callbacks
fallback/terminal-prompt.ts → TUI fallback when glimpseui native host unavailable
webview/              → Vite + React + Tailwind app
  src/components/     → SingleSelect, MultiSelect, Questionnaire, Freeform
  dist/index.html     → Single-file bundle (inlined JS + CSS) — produced by Vite + vite-plugin-singlefile
```

## Key Invariants (Never Break These)

1. **Self-contained bundle** — `dist/index.html` must have zero external network requests. All JS, CSS, and assets are inlined by `vite-plugin-singlefile`.
2. **Payload injection contract** — The placeholder `/*ASK_USER_PAYLOAD*/` in `index.html` is replaced at runtime with JSON-serialized payload. The replacement string MUST escape `<`, `>`, and `&` as `\u003c`, `\u003e`, `\u0026` to prevent HTML injection.
3. **Terminal fallback** — If `glimpseui.prompt()` throws (native host unavailable), the extension must fall back to `fallback/terminal-prompt.ts` using `ctx.ui` TUI methods. Never crash the Pi process.
4. **No setTimeout in extension factory** — The extension factory function (`export default function (pi: ExtensionAPI)`) must never use `setTimeout`, `setImmediate`, or deferred callbacks. Unhandled errors in deferred callbacks crash Pi. Use `pi.on("session_start", ...)` with `safe()` wrapper instead.
5. **Conflict detection deferred** — `detectConflict()` reads `pi.getAllTools()` which fails if called before the extension runtime is initialized. Always defer it to the `session_start` event.

## File Responsibilities

| File | Role | What to know before editing |
|------|------|----------------------------|
| `index.ts` | Registers `ask_user` tool and `/ask-debug` command | Uses `defineTool` from `pi-coding-agent`. The tool schema must match the `AskUserParams` interface. |
| `tool/ask-user.ts` | Payload construction + webview invocation | `resolveWebviewHtml()` has a two-step fallback for finding `dist/index.html`. `summarizeTitle()` extracts a window title from the question string. |
| `tool/response-formatter.ts` | Normalizes webview JSON → Pi result | Returns `AgentToolResult<AskToolDetails>`. The `details` field is used by Pi for tool result rendering. |
| `fallback/terminal-prompt.ts` | TUI fallback when webview unavailable | Handles all four payload types (`single-select`, `multi-select`, `freeform`, `questionnaire`). Questionnaire multi-select uses repeated single-selects. |
| `webview/src/components/*.tsx` | React dialog components | Each component receives `payload` prop and calls `window.glimpse.send(result)` on submit. Cancel sends `{ __cancelled: true }`. |
| `webview/src/App.tsx` | Router — dispatches to correct component based on `payload.type` | `getPayload()` reads `window.__ASK_USER_PAYLOAD__`. Error boundary shows error card if payload is missing/invalid. |
| `types/glimpseui.d.ts` | Hand-written types for `glimpseui` package | May drift from actual API. Check `node_modules/glimpseui` types if in doubt. |

## Type Sharing Between Server and Webview

Shared types live in `shared/ask-user.ts` and are imported by both the server (`tool/ask-user.ts`) and the webview (`webview/src/App.tsx`, `webview/src/components/*.tsx`).

The root `tsconfig.json` includes `shared/**/*.ts`. The webview `tsconfig.json` includes `../shared/ask-user.ts`.

**Import path divergence:** The server uses NodeNext module resolution and imports with `.js` extension (`../shared/ask-user.js`). The webview uses bundler resolution and imports without extension (`../../shared/ask-user`). This is standard and expected.

## Build Pipeline

```bash
npm run build        # build:css + build:webview
npm run build:css    # tailwindcss compilation → webview/src/index.generated.css
npm run build:webview # vite build → dist/index.html
npm run validate     # checks dist exists, payload placeholder present, glimpse binary found
npm run validate:gui # same + opens actual WebView for visual validation
```

**Critical:** `dist/index.html` is generated by `vite build` and is NOT checked into git (see `.gitignore`). The `prepack` script ensures it's built before `npm publish`.

## Testing Changes

1. **Validate build:** `npm run validate`
2. **Test webview visually:** `npm run validate:gui`
3. **Run smoke test:** `npx tsx scripts/smoke-test.ts` (opens WebView for 2s)
4. **Full visual QA:** `npx tsx scripts/visual-qa.ts` (cycles through all 5 scenarios)
5. **Dry-run pack:** `npm run check`

## Common Pitfalls

### HTML escaping drift
Test scripts (`scripts/validate.ts`, `scripts/smoke-test.ts`, `scripts/visual-qa.ts`) must use the **same escaping** as production code in `tool/ask-user.ts`. If you add a new escape there, add it to all three test scripts too.

### MultiSelect submit logic
The submit handler must block when `selected.size === 0`. The search `query` is NOT a valid submission — the freeform "Other" button exists for that purpose.

### Questionnaire dead code
The server never sends a `questionnaire` payload without `questions` array. The `getQuestions` fallback in `Questionnaire.tsx` is unreachable. Don't add more defensive code there.

### `noEmit` tsconfig
This is a Pi extension — Pi loads `.ts` files directly. `tsconfig.json` uses `"noEmit": true` for pure type-checking. Do NOT add `outDir` or `declaration` settings.

## Extension-Specific Rules

- **Indentation:** 2 spaces (TypeScript), tabs (not enforced but existing code uses 2-space)
- **Imports:** Use `.js` extensions on relative imports (NodeNext module resolution)
- **Error handling:** All deferred callbacks must be wrapped with `safe()` from `util/safe-callback.ts`
- **Console output:** Use `[pi-ask-user-glimpse]` prefix for all `console.warn`/`console.error` calls
- **Peer deps:** Only list `@earendil-works/pi-coding-agent` in `peerDependencies`. Do NOT add `@earendil-works/pi-tui` — it's not used.

## Known Issues / Deferred Work

- *No known issues at this time.*

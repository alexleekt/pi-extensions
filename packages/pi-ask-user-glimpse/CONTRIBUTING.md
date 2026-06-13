# Contributing to pi-ask-user-glimpse

Thanks for your interest in improving `@alexleekt/pi-ask-user-glimpse`!

## Development Setup

```bash
git clone https://github.com/alexleekt/pi-extensions.git
cd pi-extensions/packages/pi-ask-user-glimpse
npm install
```

## Building

```bash
npm run build        # build CSS + webview bundle
npm run check        # dry-run npm pack
```

## Testing

```bash
npm run validate           # checks dist/index.html exists and contains ASK_USER_PAYLOAD
npm run validate:gui       # reminder for manual Pi WebView validation
npm run check              # full release gate: typecheck, unit tests, build, validate, e2e, pack dry-run
```

For manual visual testing, use `/ask-debug` inside a Pi session. It offers five scenarios: `single-select`, `multi-select`, `freeform`, `questionnaire`, and `kitchen-sink` (comprehensive questionnaire with HTML context panel).

## Code Style

- **Indentation:** 2 spaces (TypeScript)
- **Imports:** Use `.js` extensions on relative imports (NodeNext module resolution)
- **Console output:** Use `[pi-ask-user-glimpse]` prefix for all `console.warn`/`console.error`. **Never use `console.log` in hooks** — it creates visual artifacts in the Pi UI.
- **Peer deps:** Only list `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` in `peerDependencies`

## Security Notes

### HTML escaping in payload injection
If you modify payload injection or test scripts, ensure HTML escaping matches production:
```ts
JSON.stringify(payload)
  .replace(/</g, "\\u003c")
  .replace(/>/g, "\\u003e")
  .replace(/&/g, "\\u0026")
```

### XSS prevention in search highlighting
`highlightMatch()` in `webview/src/util/html.ts` must escape both display text and search query before producing HTML. Never pass raw user input into `dangerouslySetInnerHTML`.

### ContextPanel sanitization
`webview/src/util/markdown.ts` uses **DOMPurify** with strict `ALLOWED_TAGS` and `ALLOWED_ATTR` lists. It blocks dangerous tags (`script`, `img`, `iframe`, `object`, `embed`, `form`, `svg`, etc.) and strips `javascript:` / `data:` URLs. Post-sanitization, link `href` attributes are rewritten with `rel="noopener noreferrer"` and `target="_blank"`. Audit the sanitizer when adding new rich content support.

## Before Submitting

- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run check` passes the full release gate
- [ ] `npm run check:pack` shows the expected runtime files (including `constants/*.ts`, excluding tests)
- [ ] `npm run validate` passes
- [ ] Manual `/ask-debug kitchen-sink` validation passes inside a Pi session

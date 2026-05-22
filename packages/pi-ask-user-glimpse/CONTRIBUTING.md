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
npm run validate           # checks dist exists, placeholder present, binary found
npm run validate:gui       # same + opens actual WebView for visual check
npm run test:with-context  # opens WebView with context panel + resizable splitter
```

For manual visual testing, use `/ask-debug` inside a Pi session. It offers five scenarios: `single-select`, `multi-select`, `freeform`, `questionnaire`, and `kitchen-sink` (comprehensive questionnaire with HTML context panel).

## Code Style

- **Indentation:** 2 spaces (TypeScript)
- **Imports:** Use `.js` extensions on relative imports (NodeNext module resolution)
- **Console output:** Use `[pi-ask-user-glimpse]` prefix for all `console.warn`/`console.error`
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
`sanitizeHtml()` blocks dangerous tags (`script`, `img`, `iframe`, `object`, `embed`, `form`, `svg`, etc.) and strips `javascript:` / `data:` URLs. Audit the sanitizer when adding new rich content support.

## Before Submitting

- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run check` shows the expected files (including `constants/`)
- [ ] `npm run validate` passes
- [ ] `npm run test:with-context` passes

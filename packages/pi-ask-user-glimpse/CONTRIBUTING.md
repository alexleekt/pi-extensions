# Contributing to pi-ask-user-glimpse

Thanks for your interest in improving `@alexleekt/pi-ask-user-glimpse`!

## Development Setup

```bash
git clone https://github.com/alexleekt/pi-ask-user-glimpse.git
cd pi-ask-user-glimpse
npm install
```

## Building

```bash
npm run build        # build CSS + webview bundle
npm run check        # dry-run npm pack
```

## Testing

```bash
npm run validate     # checks dist exists, placeholder present, binary found
npm run validate:gui # same + opens actual WebView for visual check
npx tsx scripts/smoke-test.ts     # opens WebView for 2s
npx tsx scripts/visual-qa.ts      # cycles through all 5 scenarios
```

## Code Style

- **Indentation:** 2 spaces (TypeScript)
- **Imports:** Use `.js` extensions on relative imports (NodeNext module resolution)
- **Console output:** Use `[pi-ask-user-glimpse]` prefix for all `console.warn`/`console.error`
- **Peer deps:** Only list `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` in `peerDependencies`

## Security Note

If you modify payload injection or test scripts, ensure HTML escaping matches production:
```ts
JSON.stringify(payload)
  .replace(/</g, "\\u003c")
  .replace(/>/g, "\\u003e")
  .replace(/&/g, "\\u0026")
```

## Before Submitting

- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run check` shows the expected files
- [ ] `npm run validate` passes

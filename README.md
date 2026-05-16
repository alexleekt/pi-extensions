# @alexleekt/pi-extensions

Monorepo for Pi coding agent extensions.

> **Previous standalone repos have been archived.** All development now happens here.
> - `alexleekt/pi-bump` → `packages/pi-bump`
> - `alexleekt/pi-pkg-guard` → `packages/pi-pkg-guard`
> - `alexleekt/pi-ask-user-glimpse` → `packages/pi-ask-user-glimpse`

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`pi-bump`](./packages/pi-bump) | 0.2.0 | Double-Enter nudge with randomized prompts |
| [`@alexleekt/pi-pkg-guard`](./packages/pi-pkg-guard) | 0.13.0 | Package management guard for pi extensions |
| [`pi-ask-user-glimpse`](./packages/pi-ask-user-glimpse) | 0.2.1 | Rich native WebView dialogs via glimpseui |

## Development

```bash
# Format all packages
npx @biomejs/biome check .

# Publish a package
npm publish --workspace packages/pi-bump
```

## License

MIT

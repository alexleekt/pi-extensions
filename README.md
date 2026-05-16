# @alexleekt/pi-extensions

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Monorepo for Pi coding agent extensions. All packages are published under the `@alexleekt/` scope on npm.

> **Previous standalone repos have been archived on GitHub.** All development now happens here.
> - `alexleekt/pi-bump` → `packages/pi-bump` ✅ archived
> - `alexleekt/pi-pkg-guard` → `packages/pi-pkg-guard` ✅ archived
> - `alexleekt/pi-ask-user-glimpse` → `packages/pi-ask-user-glimpse` ✅ archived

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@alexleekt/pi-ask-user-glimpse`](./packages/pi-ask-user-glimpse) | 0.2.1 | Rich native WebView dialogs via glimpseui |
| [`@alexleekt/pi-bump`](./packages/pi-bump) | 0.2.0 | Double-Enter nudge with randomized prompts |
| [`@alexleekt/pi-pkg-guard`](./packages/pi-pkg-guard) | 0.13.0 | Package management guard for pi extensions |

## Installation

Install any package via the Pi agent:

```bash
pi install @alexleekt/pi-bump
pi install @alexleekt/pi-pkg-guard
pi install @alexleekt/pi-ask-user-glimpse
```

## Development

```bash
# Install all workspace dependencies
npm install

# Type-check all packages
just typecheck

# Lint all extension code
just lint

# Format all extension code
just fmt

# Publish a package
just publish pi-bump
```

See [`AGENT.md`](./AGENT.md) for contributor guidelines, monorepo structure, and CI details.

## License

MIT

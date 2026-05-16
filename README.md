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
| [`@alexleekt/pi-bump`](./packages/pi-bump) | 0.2.4 | Double-Enter nudge with randomized prompts |
| [`@alexleekt/pi-pkg-guard`](./packages/pi-pkg-guard) | 0.13.0 | Package management guard for pi extensions |
| [`@alexleekt/pi-shared`](./packages/pi-shared) | 0.1.1 | Shared types and utilities for Pi extensions |

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

## Publishing

Releases are automated via GitHub Actions. To publish:

```bash
just release pi-bump 0.3.0
```

This bumps the version, commits, tags (`@alexleekt/pi-bump@0.3.0`), and pushes — triggering `.github/workflows/publish.yml`.

### Authentication (choose one)

| Method | Setup | Speed |
|---|---|---|
| **NPM Token** | Add `NPM_TOKEN` secret to repo settings | Works immediately |
| **Trusted Publishing** | Configure package on npm to allow `alexleekt/pi-extensions` | Zero secrets |

With Trusted Publishing, npm uses GitHub OIDC — no token needed. See [npm docs](https://docs.npmjs.com/generating-provenance-statements).

See [`AGENT.md`](./AGENT.md) for contributor guidelines, monorepo structure, and CI details.

## License

MIT

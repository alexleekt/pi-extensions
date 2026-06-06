# @alexleekt/pi-extensions

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Monorepo for [Pi](https://github.com/earendil-works/pi-coding-agent) coding agent extensions.
All packages are published under the `@alexleekt/` scope on npm.

## Development

This is a monorepo with multiple independently-published packages. Keep changes scoped to the package you're working on; avoid mixing unrelated changes in a single commit.

## Packages

| Package | Description |
|---------|-------------|
| [`@alexleekt/pi-ask-user-glimpse`](./packages/pi-ask-user-glimpse) | Rich native WebView dialogs via glimpseui |
| [`@alexleekt/pi-bump`](./packages/pi-bump) | Double-Enter nudge with randomized prompts |
| [`@alexleekt/pi-heading`](./packages/pi-heading) | One-line session heading widget for pi |
| [`@alexleekt/pi-pkg-guard`](./packages/pi-pkg-guard) | Package management guard for pi extensions |
| [`@alexleekt/pi-worktrunk-signal`](./packages/pi-worktrunk-signal) | Worktree context overlay and activity tracking for worktrunk |
| [`@alexleekt/pi-shared`](./packages/pi-shared) | Shared types and utilities for Pi extensions |

## Install

```bash
pi install npm:@alexleekt/pi-ask-user-glimpse
pi install npm:@alexleekt/pi-bump
pi install npm:@alexleekt/pi-heading
pi install npm:@alexleekt/pi-pkg-guard
pi install npm:@alexleekt/pi-worktrunk-signal
```

## License

MIT

# @alexleekt/pi-worktrunk-signal

[![npm](https://img.shields.io/npm/v/@alexleekt/pi-worktrunk-signal)](https://www.npmjs.com/package/@alexleekt/pi-worktrunk-signal)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Signal where you are in the worktrunk forest.

A [Pi](https://pi.dev) extension that brings worktree context to your terminal-native coding harness.

## Features

| Feature | What it does |
|---|---|
| **Activity Tracking** | Automatically sets 🤖/💬 markers in `wt list` when Pi is working or idle |
| **`/wt-switch-create`** | Create or re-enter a worktrunk worktree and relaunch Pi in it |
| **`/wt-list`** | Interactive worktree list — switch or create from a styled overlay |
| **`spawn_worktree_agent`** | Spawn a Pi subagent in an isolated worktree |

## Install

```bash
pi install npm:@alexleekt/pi-worktrunk-signal
```

Or symlink for local development:

```bash
ln -s $(pwd) ~/.pi/agent/extensions/pi-worktrunk-signal
```

Then `/reload` inside Pi.

## Usage

### Activity Tracking

Just use Pi normally. The extension listens to `turn_start`/`turn_end` and writes markers via git config:

```bash
$ wt list
@ main             ^⇡                         ⇡1      .                    33323bc1  1d    Initial commit
+ feature-api      ↑ 🤖              ↑1               ../repo.feature-api  70343f03  1d    Add REST API endpoints
+ review-ui      ? ↑ 💬              ↑1               ../repo.review-ui    a585d6ed  1d    Add dashboard component
```

Markers are cleared when the Pi session ends (or use `wt config state marker clear` if stale).

### `/wt-list`

Opens a box-style overlay anchored near the bottom-left (close to the input box):

```
╭────────────────────────────────────────╮
│ Worktrees                              │
│ ↑↓ select • Enter switch • Esc cancel  │
│                                        │
│ ▶ [+] Create new worktree              │
│   main  💬              ~/repo         │
│   feature-api  🤖       ~/repo.feature │
│   review-ui  💬         ~/repo.review  │
╰────────────────────────────────────────╯
```

- **↑↓** to navigate, **Enter** to select, **Esc** to cancel
- Select **`[+]`** to create a new worktree — you'll be prompted for a branch name
- Existing worktrees switch immediately via your detected multiplexer

### `/wt-switch-create`

For advanced creation with repo/task arguments:

```
/wt-switch-create my-feature
/wt-switch-create my-feature -- "Fix the auth bug"
```

Work in a different repo (supports custom `worktree-path` templates):

```
/wt-switch-create my-feature other-repo
```

When a terminal multiplexer is detected (tmux, Zellij, or herdr), Pi sends a relaunch command so the new session starts in the worktree. Without a multiplexer, the extension prints the path for manual `cd`.

**Path resolution:** The extension queries `git worktree list --porcelain` to find the actual worktree path, so it works regardless of your `worktree-path` template (sibling layout, `.worktrees/`, or any custom config).

### `spawn_worktree_agent` Tool

The LLM can spawn a subagent in an isolated worktree:

```json
{
  "branch": "refactor-auth",
  "task": "Refactor the auth module to use JWT instead of sessions"
}
```

The tool creates the worktree, spawns a headless `pi --mode json -p --no-session` process, and returns the output.

## Requirements

- [worktrunk](https://worktrunk.dev) (`wt` CLI) installed and in `$PATH`
- Git repository with worktrunk configured
- Optional: tmux, Zellij, or herdr for seamless relaunch

## License

MIT

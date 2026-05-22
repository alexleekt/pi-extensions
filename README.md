# pi-worktrunk-bridge

Bridge [worktrunk](https://worktrunk.dev) with [Pi](https://pi.dev) — bringing Claude Code-style worktree integration to the terminal-native coding harness.

## Features

| Feature | What it does |
|---|---|
| **Activity Tracking** | Automatically sets 🤖/💬 markers in `wt list` when Pi is working or idle |
| **`/wt-switch-create`** | Create or re-enter a worktrunk worktree and relaunch Pi in it |
| **`/wt-list`** | Quick `wt list` output inside Pi |
| **`/wt-statusline-refresh`** | Force-refresh the cached worktrunk statusline |
| **Footer Statusline** | Shows `wt list statusline` in Pi's footer after each turn (30s TTL cache) |
| **`spawn_worktree_agent`** | Spawn a Pi subagent in an isolated worktree |

## Install

```bash
pi install git:github.com/yourusername/pi-worktrunk-bridge
```

Or symlink for local development:

```bash
ln -s $(pwd) ~/.pi/agent/extensions/pi-worktrunk-bridge
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

### Footer Statusline (with caching)

The extension fetches `wt list statusline --format=claude-code` and displays it in Pi's footer. To avoid the 1–2 second CI latency on every turn, the result is **cached for 30 seconds**.

Force a refresh anytime:
```
/wt-statusline-refresh
```

### `/wt-switch-create`

From within Pi:

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

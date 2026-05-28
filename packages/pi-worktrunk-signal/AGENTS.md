# pi-worktrunk-signal — Agent Reference

## Project Context

Repository: `~/git/pi-extensions/packages/pi-worktrunk-signal`
Extension name: `@alexleekt/pi-worktrunk-signal`
Purpose: Bridge Pi, herdr, and worktrunk for worktree management and subagent spawning.

## Extension Overview

`pi-worktrunk-signal` bridges Pi, herdr, and worktrunk. It provides commands for worktree management and a tool for spawning subagents in isolated worktrees.

## When to use

- **Switching worktrees** — use `/wt-switch-create` instead of manual `wt switch` + `herdr workspace create`
- **Spawning subagents** — use `spawn_worktree_agent` instead of manual `herdr pane split` + `herdr pane run`
- **Interactive worktree browsing** — use `/wt-list` for a visual overlay

## Tool Parameters

The `spawn_worktree_agent` tool accepts three parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `branch` | string | Branch name for the worktree |
| `task` | string | Task description for the subagent |
| `repo` | string | Optional repo name (defaults to current repo) |

Both `branch` and `task` must be provided.

## Commands

### `/wt-switch-create <branch> [<repo>] [-- <task>]`

Creates a worktree (or uses existing), creates a herdr workspace for it, and relaunches Pi in that workspace.

**Key behavior:**
- Uses `herdr workspace create --cwd <path> --label <branch> --no-focus` — does NOT steal focus
- Sets the Pi session name to the branch name via `setSessionName` API
- Falls back to `herdr pane run` in current pane if workspace creation fails

**Examples:**
```
/wt-switch-create feature-auth -- "Refactor auth to JWT"
/wt-switch-create fix-bug other-repo -- "Fix the login bug"
```

### `/wt-list`

Shows an interactive overlay of all worktrees. Select one to switch, or create new.

### `/wt-merge <target>`

Merge the current worktree into the target branch. Use from the feature branch:

```
/wt-merge main
```

### `/wt-remove [<branch>]`

Remove a worktree. Defaults to the current branch if no argument given.

### `/wt-commit`

Generate a commit message via the configured LLM (`wt step commit`) and commit.

## Tool: `spawn_worktree_agent`

### Herdr behavior

When inside herdr (`HERDR_ENV=1`):
1. Creates worktree with `wt switch --create --no-cd --no-hooks <branch>`
2. Splits a new pane: `herdr pane split --direction right --no-focus`
3. Runs the subagent: `herdr pane run <new-pane> "cd <path> && pi --no-session '<task>'"`
4. Returns the pane ID for coordination

### Non-herdr behavior

Falls back to a headless `spawn("pi", ["--mode", "json", "-p", "--no-session", "--cwd", path, task])`.

### Coordination after spawning

Always wait for the subagent to finish:

```bash
herdr wait agent-status <pane-id> --status done --timeout 300000
herdr pane read <pane-id> --source recent --lines 100
```

Or with the `herdr` tool:
```json
{ "action": "wait_agent", "pane": "reviewer", "status": "done", "timeout": 300000 }
{ "action": "read", "pane": "reviewer", "source": "recent", "lines": 100 }
```

## State Bridge

`bridge.ts` is a standalone daemon. It syncs herdr agent status to worktrunk markers so `wt list` shows `🤖`/`💬`/`⏸️`.

- Removed from the extension itself (no `turn_start`/`turn_end` markers)
- Run manually: `node bridge.ts`
- Polls herdr socket every 5 seconds

## Important Notes

- `--no-cd --no-hooks` is always passed to `wt switch --create` when spawning subagents
- `--no-focus` is always used when creating herdr workspaces
- The extension does NOT steal focus — the user chooses when to switch
- `HERDR_ENV` must be `1` for herdr integration to activate
- If `@ogulcancelik/pi-herdr` is installed, prefer the structured `herdr` tool over raw CLI commands

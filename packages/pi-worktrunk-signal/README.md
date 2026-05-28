# pi-worktrunk-signal

Signal where you are in the worktrunk forest — activity tracking and worktree switching for [Pi](https://pi.dev) inside [herdr](https://herdr.dev).

## What it does

- **Worktree switching** — create or switch worktrees with `/wt-switch-create`, relaunching Pi in a herdr-managed workspace
- **Interactive worktree list** — browse, switch, and create worktrees with `/wt-list`
- **Lifecycle commands** — merge, remove, and commit from within Pi
- **Subagent spawning** — spawn Pi subagents in isolated worktrees via the `spawn_worktree_agent` tool
- **Status bridge** — optional `bridge.ts` daemon syncs herdr agent status to worktrunk markers

## Commands

| Command | Usage | Description |
|---------|-------|-------------|
| `/wt-list` | `/wt-list` | Interactive worktree list with overlay — select to switch or create new |
| `/wt-switch-create` | `/wt-switch-create <branch> [<repo>] [-- <task>]` | Create or re-enter a worktree, then create a herdr workspace and relaunch Pi |
| `/wt-merge` | `/wt-merge <target>` | Merge the current worktree into the target branch |
| `/wt-remove` | `/wt-remove [<branch>]` | Remove a worktree (defaults to current branch) |
| `/wt-commit` | `/wt-commit` | Generate an LLM commit message via `wt step commit` and commit |

### `/wt-switch-create` examples

```
/wt-switch-create feature-auth -- "Refactor auth to JWT"
/wt-switch-create fix-bug other-repo -- "Fix the login bug"
```

The `--no-focus` flag is used so the current pane isn't stolen — you can switch to the new workspace when ready.

## Tools

### `spawn_worktree_agent`

Spawns a Pi subagent in an isolated worktree. Creates a herdr-managed pane so the subagent is visible in the UI.

```json
{
  "branch": "refactor-auth",
  "task": "Refactor auth to JWT",
  "repo": "my-repo"
}
```

The tool:
1. Creates the worktree with `wt switch --create --no-cd --no-hooks`
2. Resolves the actual worktree path (handles custom templates)
3. In herdr: splits a new pane and runs Pi there
4. Falls back to a headless subprocess for non-herdr multiplexers

**After spawning, coordinate with the subagent:**

```bash
herdr wait agent-status <new-pane-id> --status done --timeout 300000
herdr pane read <new-pane-id> --source recent --lines 100
```

## State Bridge

`bridge.ts` is an optional background daemon that syncs herdr agent status to worktrunk markers.

### What it does

- Polls herdr every 5 seconds via Unix socket
- Reads `agent_status` per pane (`working`, `idle`, `blocked`, `done`)
- Writes markers to `worktrunk.state.<branch>.marker`:
  - `working` → `🤖`
  - `idle`/`done` → `💬`
  - `blocked` → `⏸️`
- Clears markers when a branch has no active panes

### Running it

```bash
node bridge.ts
```

Or run it in a dedicated herdr pane:

```bash
herdr pane split --direction down --no-focus
herdr pane run <new-pane> "node bridge.ts"
```

## Requirements

- [herdr](https://herdr.dev) (for workspace/pane integration)
- [worktrunk](https://worktrunk.dev) (for worktree management)
- `@ogulcancelik/pi-herdr` (optional, for the structured `herdr` tool)

## Installation

```bash
pi install npm:@alexleekt/pi-worktrunk-signal
```

For local development, symlink the source directory:

```bash
ln -s ~/git/pi-extensions/packages/pi-worktrunk-signal ~/.pi/agent/extensions/pi-worktrunk-signal
```

Then `/reload` inside Pi.

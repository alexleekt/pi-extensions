# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

- **Statusline feature**: Removed automatic footer statusline, `/wt-statusline-refresh` command, `fetchStatusline()`, `invalidateStatuslineCache()`, and all related caching infrastructure. Statusline was duplicative of `wt list` output and added 1–2s latency per turn.

## [0.2.0] - 2026-05-22

### Added

- **`/wt-list` overlay redesign**: Box-style overlay anchored `bottom-left` near the input box with `│ ╭ ╰` borders drawn via custom `render()`
- **Inline create in `/wt-list`**: `[+] Create new worktree` as first SelectList item — prompts for branch name, creates, and relaunches
- **`relaunchInWorktree()` helper**: Extracted shared path resolution + multiplexer relaunch logic (tmux/zellij/herdr)
- **`visibleLen()` helper**: Strips ANSI escape sequences to measure display width for border padding

### Changed

- **Renamed package**: `pi-worktrunk-bridge` → `@alexleekt/pi-worktrunk-signal`
- **Statusline format**: Switched from `claude-code` to `table` — avoids stdin hang in non-interactive contexts
- **`/wt-list` sizing**: More compact overlay (`width: "45%"`, `maxHeight: "40%"`)
- **`/wt-switch-create`**: Simplified to use shared `relaunchInWorktree()` helper

### Removed

- **Footer widget** (`🌲 main 💬 ↑21`): Duplicative of the statusline. Removed `getGitAheadBehind()`, `buildWidgetLines()`, and all `setWidget()` calls

### Fixed

- **Statusline hang**: `wt list statusline --format=claude-code` reads JSON from stdin and hangs in non-interactive `exec()` calls, hitting the 3000ms timeout with no output. Switched to `--format=table` which works without stdin

## [0.1.0] - 2026-05-21

### Added

- Initial release of pi-worktrunk-bridge
- **Activity Tracking**: Automatically sets 🤖/💬 markers via `git config` on `turn_start`/`turn_end`
- **Footer Widget**: Persistent widget showing branch + activity marker + ahead/behind
- **Footer Statusline**: Caches `wt list statusline` for 30s, refreshes after each turn
- **`/wt-switch-create`**: Create worktree + relaunch Pi via detected multiplexer
- **`/wt-list`**: Interactive worktree list with SelectList overlay
- **`/wt-statusline-refresh`**: Force-refresh cached statusline
- **`spawn_worktree_agent` tool**: Spawn Pi subagent in isolated worktree
- Path resolution via `git worktree list --porcelain` (handles custom `worktree-path` templates)

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Backspace slowness**: The terminal input handler no longer consumes double-tapped backspace/delete keys. Previously, any double-tap of monitored keys within 300ms returned `{ consume: true }`, silently swallowing every second backspace stroke. Now only `Enter` double-taps are consumed (and only when the agent is idle). Backspace and delete pass through normally.
- **Event-loop blocking from `context` handler**: The `pi.on("context")` handler used `.map()` to allocate a new array on every context event, causing O(n) churn per LLM turn. It now scans with `.some()` first and only allocates when an invisible continue marker is present — eliminating array allocation in the 99% case.
- **Race condition in `input` handler**: The `pi.on("input")` handler was declared `async` with no `await`, deferring escalation reset to a microtask. This created a race where a rapid assistant response could compare against the previous turn's fingerprint, triggering false escalation. Both `input` and `context` handlers are now synchronous.
- **debugSessions leak**: `debugSessions` entries were never cleaned up on session shutdown, causing unbounded Set growth. Now properly deleted in the `session_shutdown` handler.

### Changed

- **Conditional key monitoring**: In normal mode, only `Enter` is monitored for double-tap detection (down from 5 keys: enter, backspace, delete, ctrl+enter, alt+enter). This reduces `matchesKey()` calls by 80% per keystroke. Debug mode (`BUMP_DEBUG=1`) still monitors all keys.
- **Fast-path for typed input**: The editor text check happens before key matching. When the user is actively typing, only Enter needs to be matched — avoiding unnecessary `matchesKey()` work.

## [0.3.1] - 2026-05-21

### Added

- **Hybrid escalation strategy**: When loop detection notices identical tool calls or exact text duplicates across the last two assistant responses, the next continue automatically escalates from an invisible `customType` message to a visible randomized user message (e.g. "Continue", "Keep going", "What's next?"). This breaks loops that the invisible tier alone cannot escape.
- Restored `NUDGE_MESSAGES` pool with 16 varied nudge prompts for the visible escalation tier.
- Per-session loop detection using response fingerprints (text + tool call signatures).
- `/continue status` now shows whether the session is escalated.
- `session_shutdown` cleanup — per-session state (`lastFingerprints`, `needsEscalation`) is deleted when a session ends.
- Debug warning when fingerprint extraction fails (only when `BUMP_DEBUG=1`).

### Changed

- Removed "Continue blocked" warning — instead of blocking on duplicate responses, pi-bump now escalates to a visible nudge on the next continue attempt.
- Duplicate detection now compares tool call fingerprints in addition to text content.
- Fixed broken duplicate-detection window (original code captured `undefined` as previous response, so detection never fired).
- `sendContinue()` now uses `try/catch` instead of `Promise.resolve().catch()` — correctly handles synchronous throws from `sendMessage`/`sendUserMessage`.
- Simplified codebase: removed `TextPart` interface, `isDuplicateResponse` function, `findMatchedKey` function, `DEBUG_KEYS_LIST` constant — inlined where needed.

## [0.3.0] - 2026-05-17

### Changed

- **Invisible continuation**: Replaced visible nudge messages with hidden `customType` messages. The LLM no longer sees any prompt when continuing.
- Added `pi.on("context")` guard to proactively strip leaked continue markers from context before LLM calls.

### Added

- `/continue` command with `status` and `help` subcommands for manual invisible continuation.

### Removed

- `NUDGE_MESSAGES` and randomized nudge pool. No more "Continue", "Keep going", etc. polluting the conversation.

## [0.2.4] - 2026-05-16

### Changed

- Refined nudge message pool to pure continue/keep-going variations; removed directional prompts like "Go deeper", "Expand on this", etc.

## [0.2.0] - 2026-05-16

### Changed

- Replaced hardcoded "Bump" message with 16 randomized nudge variations to avoid version-bump ambiguity and repetition fatigue

## [0.1.0] - 2026-05-16

### Added

- Double-Enter detection on empty editor sends "Bump" message
- Guard against firing while streaming or when messages are pending
- Basic integration test coverage

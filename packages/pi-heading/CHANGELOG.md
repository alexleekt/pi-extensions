# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-07-04

### Fixed

- **Provider-specific request params** — `response_format` is now only sent to OpenAI chat-completions providers, and `temperature` is suppressed for OpenAI responses API. Fixes HTTP 400 errors on Anthropic and OpenAI Responses providers.

## [Unreleased]

### Changed

- Adopt Pi 0.80.4's `agent_settled` lifecycle event so headings are not finalized between retries, compaction retries, or queued follow-ups.
- Render goal and achievement text exclusively through Pi's native working-message row; remove decorative phase prefixes and transcript achievement cards.
- Resolve user configuration and prompt overrides through Pi's `getAgentDir()` API.
- Use the Pi 0.80-compatible `@earendil-works/pi-ai/compat` completion import and TypeBox 1 schema API.

### Added

- Restore branch-specific headings after `/tree` navigation.
- Forward Pi's active `AbortSignal` to summary model calls.
- Add packed-install import smoke coverage and declare all Pi-provided peers.
- Add regression coverage for state lookup after the session leaf advances.

### Fixed

- Include `handlers/`, `util/`, and `types.ts` in the npm tarball; published 0.1.3 artifacts omitted required runtime modules.
- Keep prompt-derived placeholders transient and use a non-sensitive fallback when summarization returns an empty goal.
- Clear stale achievements when a new goal begins.
- Resolve transient state from ancestor entries after assistant/tool entries advance the active leaf.
- Restore user-only permissions on existing debug and config files, not only newly created files.

- **Removed `setWorkingVisible` suppression** — `setWorkingVisible(false)` was hiding the entire working row, making the widget invisible. The widget spinner now coexists with Pi's native loader.
- **Placeholder survival** — `agent_start` and `turn_start` no longer clear the heading when no state exists, preserving the `before_agent_start` placeholder during the async summarize gap.
- **Cross-session state leak** — `session_start` now clears stale in-memory state so old goals don't resurrect.
- **Post-`agent_end` race** — `before_agent_start` async callbacks that complete after `agent_end` no longer revert the widget from achievement mode back to goal mode.
- **Event-bus deduplication** — `exposeHeading` now skips duplicate emissions to reduce noise during multi-turn tool-call chains.

### Added

- Regression tests for placeholder survival through `agent_start` and `turn_start`.
- Smoke test verifying no handler calls `setWorkingVisible`.
- Session-boundary test ensuring stale in-memory state is cleared.

## [0.1.2] - 2026-05-27

### Changed

- Standardize package descriptions, keywords, and README format across all packages
- Refactor AGENT.md files per my-agent-rules

## [0.1.1] - 2026-05-20

### Fixed

- **Spinner continuity across tool-call turns** (ADR-0003): `turn_end` now checks `event.toolResults` to distinguish intermediate vs final turns. Intermediate turns keep the spinner running and skip achievement summarization. Final turns stop the spinner and show the `✓` prefix. Previously the spinner flickered and showed a misleading checkmark during multi-turn tool-call sequences.
- **Spinner interval thrashing**: `startSpinner()` now deduplicates — if already running with the same text, it no longer clears and recreates the interval between `turn_start` events.

### Added

- Regression tests for intermediate turn behavior (spinner continuity, async summarize skip, final turn behavior, spinner deduplication).

## [0.1.0] - 2026-05-14

### Added

- Initial release: one-line session heading widget for Pi.
- LLM-summarized topic + goal after every user message.
- Braille spinner (`⠋`) during agent execution.
- Achievement summary (`✓`) after each turn.
- Per-branch persistence via `pi.appendEntry("heading", state)`.
- Topic stability guard to prevent label jitter.
- `/heading`, `/heading-model`, `/heading-debug` slash commands.
- Customizable prompts (`topic.md`, `goal.md`, `achievement.md`) with YAML frontmatter.

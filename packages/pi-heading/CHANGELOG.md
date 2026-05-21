# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

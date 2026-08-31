# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-08-31

### Changed

- The `heading` tool is silent in the transcript: tool calls and results render as empty components, so heading checks no longer add visible rows to the chat.

### Fixed

- Pack-smoke temporary installs now ignore inherited npm `allow-scripts` configuration, avoiding npm 12's `EALLOWSCRIPTS` rejection.
- Biome 2.5.11 lint findings are resolved, including typed test callbacks and intentional terminal-control regex suppressions.

## [0.3.0] - 2026-08-29

### Added

- Automatic model selection: rank Pi's scoped models subscription-first (OAuth models before API-key models), tie-broken by scoped-list order, then provider/id; cheapest API models by input + output cost.
- Bounded fallback loop for summaries: top 3 ranked candidates tried in order on auth, provider, or empty-summary failures; hard errors are surfaced, all-empty results fall back to the existing non-sensitive heading.
- Reasoning suppression for heading calls: native off where providers support it, `reasoning: "low"` for models that cannot disable thinking (GLM, GPT-5.x Codex), verified to produce zero reasoning tokens.
- Intermediate tool turns distill the agent's latest activity into the streaming row, so the header tracks follow-up work instead of freezing on the initial goal.
- Goal extraction receives the previous achievement as low-weight context with turn-based decay, so vague follow-ups ("continue", "also") anchor to what was just completed; the latest message always wins.
- Token-budget floor (512–1024, clamped to the model's `maxTokens`) so thinking models cannot starve the answer.
- Fallback-loop test coverage: hard-failure, empty-result, all-empty, mixed-failure, auth-failure, and abort paths.

### Changed

- Raised the minimum `@earendil-works/pi-coding-agent` version to 0.81.0 for scoped model selection.
- `/heading-model` reset option renamed to **Automatic (subscription first)**; selection now prefers Pi's `ctx.scopedModels` over hand-read settings.
- Model overrides are stored and matched as `provider/id` to disambiguate duplicate ids across providers.
- Achievements persist as a checkmarked widget above the editor; the working-message row only renders while streaming, so settle-time achievements previously vanished. Goal/spinner stay in the row; new work clears the widget.
- Prior LLM output is sanitized (C0/ANSI/OSC stripped, 200-character cap) before prompt interpolation and UI rendering.

### Fixed

- `/heading-model` lists Pi's scoped models instead of the full registry, labeling the dialog source and matching selections by `provider/id`.
- Provider errors returned as `stopReason: "error"` assistant messages are now treated as hard failures instead of empty summaries, surfacing outages instead of silently dropping headings.
- `openai-codex-responses` no longer receives `temperature: 0` (HTTP 400) and is grouped with `openai-responses` for temperature support.
- Empty summaries from thinking models no longer masquerade as successes; they fall through to the next candidate.
- A slow intermediate-turn summary can no longer overwrite the final achievement widget (per-turn display generation).
- Goal-context decay state (`priorOutcome`/`priorAge`) round-trips through persisted state and branch replay.

## [0.2.0] - 2026-07-15

### Added

- Restore branch-specific headings after `/tree` navigation.
- Forward Pi's active `AbortSignal` to summary model calls.
- Add packed-install import smoke coverage and declare all Pi-provided peers.
- Add regression coverage for state lookup after session leaf advancement, placeholder survival, native working-message rendering, and session-boundary cleanup.

### Changed

- Adopt Pi 0.80.4's `agent_settled` lifecycle event so headings are not finalized between retries, compaction retries, or queued follow-ups.
- Render goal and achievement text exclusively through Pi's native working-message row; remove decorative phase prefixes and transcript achievement cards.
- Resolve user configuration and prompt overrides through Pi's `getAgentDir()` API.
- Use the Pi 0.80-compatible `@earendil-works/pi-ai/compat` completion import and TypeBox 1 schema API.
- Return only the current goal from the `heading get` tool action.

### Fixed

- Include `handlers/`, `util/`, and `types.ts` in the npm tarball; published 0.1.3 artifacts omitted required runtime modules.
- Preserve first-message heading availability after session leaf advancement without persisting raw prompt placeholders.
- Use a non-sensitive fallback when summarization returns an empty goal.
- Clear stale achievements when a new goal begins.
- Restore user-only permissions on existing debug and config files, not only newly created files.
- Stop `setWorkingVisible(false)` from hiding the entire native working row.
- Preserve the `before_agent_start` placeholder through `agent_start` and `turn_start`.
- Clear stale in-memory state at session boundaries.
- Prevent settled or stale async callbacks from reverting the final heading.
- Deduplicate event-bus emissions during multi-turn tool-call chains.

## [0.1.3] - 2026-07-04

### Fixed

- **Provider-specific request params** — `response_format` is now only sent to OpenAI chat-completions providers, and `temperature` is suppressed for OpenAI responses API. Fixes HTTP 400 errors on Anthropic and OpenAI Responses providers.

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

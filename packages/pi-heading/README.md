# @alexleekt/pi-heading

[![npm](https://img.shields.io/npm/v/@alexleekt/pi-heading)](https://www.npmjs.com/package/@alexleekt/pi-heading)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Know where you are at a glance.

A one-line session heading for the Pi coding agent. It summarizes the current goal while Pi works, then replaces it with a short achievement when the run finishes.

## What it looks like

```text
Clean up the old chezmoi checkout
```

After completion:

```text
Removed stale dotfiles and migrated the setup to yadm
```

The extension uses Pi's native working-message row. There are no borders, custom panels, duplicate transcript cards, or competing animation timers.

## Features

| Feature | What it does |
|---------|--------------|
| **Auto-summarized heading** | Generates a concise goal after every user message |
| **Achievement summary** | Shows what the agent completed after the final turn |
| **Stable topic** | Keeps a 2–4 word topic label from jittering between related turns |
| **Branch-aware state** | Restores the correct heading after session resume and `/tree` navigation |
| **Native lifecycle integration** | Finalizes on Pi's `agent_settled` event, after retries, compaction, and queued follow-ups |
| **Cancellation-aware calls** | Passes Pi's active `AbortSignal` to heading model requests |
| **Custom prompts and model** | Supports editable prompts and automatic subscription-first model selection with manual override |
| **Extension API** | Exposes current state through the `heading` tool and `heading:state` event |

## Requirements

- Pi coding agent **0.80.4 or newer**

## Installation

```bash
pi install @alexleekt/pi-heading
```

For local development:

```bash
ln -s ~/git/pi-extensions/packages/pi-heading ~/.pi/agent/extensions/pi-heading
```

Run `/reload` after changing extension code. Pi loads TypeScript through jiti, so clearing jiti's cache may be necessary when retargeting symlinks.

## Usage

The heading updates automatically. No command is required.

### `/heading`

Set the current goal manually:

```text
/heading
Session heading: Migrating from Docker to Kubernetes
```

### `/heading-model`

By default, pi-heading chooses from Pi's scoped models, preferring subscription-authenticated models before the cheapest API-key model. Use `/heading-model` to choose a manual override, or select **Automatic (subscription first)** to return to automatic selection.

#### How a model is chosen

Every heading summary runs this deterministic ranking (no caching; re-evaluated per call so auth and scoping changes apply immediately):

1. **Manual override** — a model picked via `/heading-model`, if still available.
2. **Pi's scoped models** — the resolved `--models` + `enabledModels` list (`ctx.scopedModels`). Models from an enabled provider that are not listed are never used.
3. Within that list: **subscription-authenticated (OAuth) models first** — marginal cost is already paid — tie-broken by their order in the scoped list, then provider/id.
4. **API-key models after**, by cheapest input + output price, same tie-breakers.
5. Fallback to the active session model if nothing matches.

For example, with `enabledModels: ["openrouter/z-ai/glm-5.3-flash", "openai-codex/gpt-5.6-luna"]` and both providers authenticated:

| Rank | Model | Why |
|------|-------|-----|
| 1 | `openai-codex/gpt-5.6-luna` | subscription auth (OAuth) — no marginal cost |
| 2 | `openrouter/z-ai/glm-5.3-flash` | API key — $0.325/M in+out |

#### Bounded fallback

Summaries run on cheap, non-critical calls, so the fallback loop is deliberately simple: the top 3 ranked candidates are tried in order; a candidate that fails auth, returns a provider error, or yields an empty summary is skipped; `AbortSignal` cancellation stops everything immediately. No health tracking or persistent demotion — the ranking is re-evaluated fresh on every call.

#### Reasoning suppression

Heading prompts are 12-word summaries; thinking models waste their token budget reasoning about them. The extension disables thinking natively where providers support it (Anthropic, Google), and pins `reasoning: "low"` for models that cannot disable thinking (e.g. GLM, GPT-5.x Codex) — verified to yield zero reasoning tokens. A 512–1024 token budget floor plus empty-result fallback guards any provider where thinking cannot be suppressed.

### `/heading-debug`

```text
/heading-debug on
/heading-debug off
/heading-debug clear
/heading-debug
```

Debug mode writes structured prompts, user input, responses, and errors to a private log under Pi's agent directory. The file is restricted to the current user, but it can contain sensitive conversation content; enable it only while diagnosing a problem and clear it afterward.

## Agent tool

The extension registers a `heading` tool:

- `action: "get"` returns topic, goal, and latest achievement.
- `action: "skill"` returns the heading behavior guide.

The tool's prompt metadata asks the agent to check the current session goal before changing direction.

## Event bus integration

Other extensions can subscribe without importing pi-heading:

```typescript
pi.events.on("heading:state", (payload) => {
    const { topic, goal, achievement, mode } = payload as {
        topic: string;
        goal: string;
        achievement?: string;
        mode: "goal" | "working" | "achievement" | "idle";
    };
});
```

See [PI-INTEGRATION.md](PI-INTEGRATION.md) for the payload contract.

## Custom prompts

Packaged defaults live in `prompts/`. To override them, create matching files under:

```text
~/.pi/agent/extensions/pi-heading/prompts/
├── topic.md
├── goal.md
└── achievement.md
```

If `PI_CODING_AGENT_DIR` is set, pi-heading follows Pi's configured agent directory instead of hardcoding `~/.pi/agent`.

Each prompt supports YAML frontmatter with `max_words`:

```yaml
---
max_words: 4
---
Summarize the user's message as a concise topic label.

Message: {message}
```

Placeholders:

- `{message}` — input being summarized
- `{goal}` — current goal, available to the achievement prompt
- `{max_words}` — parsed frontmatter limit

## Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant Pi
    participant Heading as pi-heading
    participant Model as Summary model

    Pi->>Heading: session_start / session_tree
    Heading->>Heading: replay latest branch heading

    User->>Pi: submit prompt
    Pi->>Heading: before_agent_start
    Heading->>Pi: setWorkingMessage(prompt placeholder)
    Heading-->>Model: topic + goal (non-blocking, abort-aware)
    Pi->>Heading: agent_start / turn_start
    Heading->>Pi: setWorkingMessage(goal)

    alt Intermediate tool turn
        Pi->>Heading: turn_end with toolResults
        Heading->>Heading: keep goal; skip achievement call
    else Final text turn
        Pi->>Heading: turn_end without toolResults
        Heading-->>Model: achievement (non-blocking, abort-aware)
        Heading->>Pi: setWorkingMessage(achievement)
    end

    Pi->>Heading: agent_settled
    Heading->>Pi: keep latest goal or achievement
```

`agent_settled` is intentionally used instead of `agent_end`: Pi can retry, compact and retry, or process queued follow-ups after a low-level agent run ends.

## Prompt evaluation

```bash
bun tools/prompt-eval.ts topic
bun tools/prompt-eval.ts goal
bun tools/prompt-eval.ts topic-goal firepass test-cases-comprehensive.json
```

The optimizer mutates prompt files in place, so back them up first:

```bash
bun tools/prompt-eval.ts optimize topic prompts/topic.md \
  "Concise 1-4 word noun phrases, no articles" \
  90 firepass test-cases-comprehensive.json
```

## Development

```bash
npm run typecheck
npm test
npm run pack-smoke
```

`pack-smoke` packs the npm artifact, verifies all transitive runtime files are present, installs it into a temporary project with declared peers, and imports the TypeScript entrypoint through Pi's jiti loader.

## License

MIT

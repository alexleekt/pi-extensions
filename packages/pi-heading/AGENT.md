---
parent: ../../AGENT.md
---

# AGENT.md — @alexleekt/pi-heading

> Project-specific guidelines for AI agents working on this codebase.

## Monorepo Context

This package lives inside the `pi-extensions` monorepo. See [`../../AGENT.md`](../../AGENT.md) for monorepo-wide conventions (shared tooling, just commands, release process, CI setup).

## Purpose

A **one-line session heading widget** for the Pi coding agent.

- **Always-visible** — a single line above the editor shows the current goal
- **Anti-ghosting** — renders as plain text via `ctx.ui.setWidget()`, no borders, no pi-tui components
- **LLM-summarized** — after every user message, a fast model derives a 2-4 word topic + one-sentence goal
- **Topic-stable** — edit-distance guard prevents jitter between semantically-equivalent labels
- **Per-branch persistence** — `pi.appendEntry("heading", { topic, goal })` survives session restarts
- **User-editable prompts** — two markdown files with YAML frontmatter (`topic.md`, `goal.md`)

## Architecture

```
index.ts              → Extension entrypoint (hooks + slash commands)
llm/
  summarize.ts        → Reads prompt files, calls stream() from @earendil-works/pi-ai
  picker.ts           → Model selection: session model default, user override via config.json
state/
  store.ts            → In-memory Map keyed by leafId + per-branch replay via appendEntry
  guard.ts            → Topic stability filter (word-overlap ≥ 70%)
ui/
  widget.ts           → One-line setWidget renderer (no components, no borders)
prompts/
  topic.md            → Default topic prompt (max_words: 4)
  goal.md             → Default goal prompt (max_words: 12)
```

## Key Invariants (Never Break These)

1. **One line only** — `renderWidget()` must produce exactly one string. No borders, no background functions, no multi-line arrays.
2. **Never block the agent** — `before_agent_start` handler fires the summarize work as `void (async () => { ... })()` (fire-and-forget). Awaiting `summarize()` in the hook would stall the agent for 1-3 seconds.
3. **Passive widget** — No keyboard focus, no hotkeys, no `handleInput`. The widget is read-only.
4. **Prompt file frontmatter** — `readPromptFile()` parses YAML frontmatter for `max_words`. The regex must handle empty frontmatter (`---\n---\n`) and missing trailing newlines.
5. **Symlink-safe paths** — `import.meta.dirname` resolves to the symlink target (`~/.pi/agent/extensions/pi-heading/`), so `prompts/` is a sibling, NOT `../prompts`.

## File Responsibilities

| File | Role | What to know before editing |
|------|------|----------------------------|
| `index.ts` | Hooks `session_start`, `before_agent_start`, `session_shutdown`; registers `/heading`, `/heading-model` | The `before_agent_start` handler must NOT await `summarize()`. Use fire-and-forget. |
| `llm/summarize.ts` | Prompt file reading + LLM streaming | `readPromptFile()` is exported for tests. `runPrompt()` calls `stream()` from `@earendil-works/pi-ai` directly. |
| `llm/picker.ts` | Config-based model override | `configDir` parameter is injected for testability. Default path is `~/.pi/agent/extensions/pi-heading/`. |
| `state/store.ts` | In-memory state + branch replay | `replayBranch()` walks `ctx.sessionManager.getBranch()` backwards for `"heading"` custom entries. |
| `state/guard.ts` | Topic stability | Word-overlap threshold is 0.7 (70%). Normalization strips punctuation but preserves word boundaries. |
| `ui/widget.ts` | Widget rendering | Uses `ctx.ui.theme.fg("muted", "▸ ")` + `ctx.ui.theme.fg("text", goal)`. Never add borders. |


## Model Calling from Extensions

We call `@earendil-works/pi-ai` directly (not through Pi's agent loop):

```typescript
const model = registry.getAvailable().find(m => m.id === modelId);
const auth = await registry.getApiKeyAndHeaders(model);
const events = stream(model, { messages }, {
  apiKey: auth.apiKey,
  maxTokens: 256,
  temperature: 0,
});
for await (const event of events) {
  if (event.type === "text_delta") { /* ... */ }
}
```

## Prompt File Format

```yaml
---
max_words: 4
---
Summarize the user's message as a concise topic label.

User message:
{message}
```

- `max_words` is read by `readPromptFile()` and enforced by `truncateToWords()` post-generation
- `{message}` is the only supported placeholder
- Files live in `~/.pi/agent/extensions/pi-heading/prompts/` (user-editable)

## Testing

- **Unit tests**: `bun test` (29 tests across 3 files)
- **Type-check**: `npm run check`
- **Manual**: Symlink into `~/.pi/agent/extensions/`, start Pi, send a message

## Extension-Specific Rules

- **Indentation:** 2 spaces (TypeScript)
- **Imports:** Use `.js` extensions on relative imports (NodeNext module resolution)
- **Console output:** Use `[pi-heading]` prefix for all `console.error`/`console.warn`
- **Peer deps:** `@earendil-works/pi-coding-agent` only. `pi-tui` is intentionally NOT used.

## Known Issues / Deferred Work

- Model validation on startup (ROADMAP item) — validates API key before saving override
- `/heading-model` shows all models; a cheap-model filter is deferred to a future release

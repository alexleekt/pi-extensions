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
  summarize.ts        → Reads prompt files, calls completeSimple() from @earendil-works/pi-ai
  picker.ts           → Model selection: session model default, user override via config.json
state/
  store.ts            → In-memory Map keyed by leafId + per-branch replay via appendEntry
  guard.ts            → Topic stability filter (word-overlap ≥ 70%)
  debug.ts            → Debug log persistence to temp file, entry formatting
debug.log             → Runtime debug log (auto-created in temp dir when debug enabled)
ui/
  widget.ts           → One-line setWidget renderer (no components, no borders)
prompts/
  topic.md            → Default topic prompt (max_words: 4)
  goal.md             → Default goal prompt (max_words: 12)
  achievement.md      → Default achievement prompt (max_words: 12, uses {goal} placeholder)
```

## Key Invariants (Never Break These)

1. **One line only** — `renderWidget()` must produce exactly one string. No borders, no background functions, no multi-line arrays.
2. **Never block the agent** — `before_agent_start` handler fires the summarize work as `void (async () => { ... })()` (fire-and-forget). Awaiting `summarize()` in the hook would stall the agent for 1-3 seconds.
3. **Passive widget** — No keyboard focus, no hotkeys, no `handleInput`. The widget is read-only.
4. **Prompt file frontmatter** — `readPromptFile()` parses YAML frontmatter for `max_words`. The regex must handle empty frontmatter (`---\n---\n`) and missing trailing newlines.
5. **Symlink-safe paths** — `import.meta.dirname` resolves to the symlink target (`~/.pi/agent/extensions/pi-heading/`), so `prompts/` is a sibling, NOT `../prompts`.
6. **Placeholder substitution in instructions** — `runPrompt()` replaces `{goal}` and `{max_words}` in both the instructions (system prompt) and template (user message) before sending to the LLM.

## File Responsibilities

| File | Role | What to know before editing |
|------|------|----------------------------|
| `index.ts` | Hooks `session_start`, `before_agent_start`, `session_shutdown`; registers `/heading`, `/heading-model`, `/heading-debug` | The `before_agent_start` handler must NOT await `summarize()`. Use fire-and-forget. |
| `llm/summarize.ts` | Prompt file reading + LLM calls | `readPromptFile()` is exported for tests. `runPrompt()` calls `completeSimple()` from `@earendil-works/pi-ai` directly. |
| `llm/picker.ts` | Config-based model override | `configDir` parameter is injected for testability. Default path is `~/.pi/agent/extensions/pi-heading/`. |
| `state/store.ts` | In-memory state + branch replay | `replayBranch()` walks `ctx.sessionManager.getBranch()` backwards for `"heading"` custom entries. |
| `state/guard.ts` | Topic stability | Word-overlap threshold is 0.7 (70%). Normalization strips punctuation but preserves word boundaries. |
| `state/debug.ts` | Debug log persistence | Structured JSON-line log to temp file. `logDebug()` is no-op when debug disabled. |
| `ui/widget.ts` | Widget rendering | Uses `ctx.ui.theme.fg("muted", "▸ ")` + `ctx.ui.theme.fg("text", goal)`. Never add borders. |
| `tools/prompt-eval.ts` | CLI runner for prompt evaluation | Thin wrapper over `@alexleekt/pi-shared/prompt-eval`. Handles `topic`, `goal`, `topic-goal`, and `optimize` commands. |
| `tools/suites/topic.suite.ts` | Topic evaluation suite | Factory functions: `createSuite(promptPath?)` and `suiteFactory(testCasesFile)` for static vs. optimization use. |
| `tools/suites/goal.suite.ts` | Goal evaluation suite | Same pattern as topic suite. Uses `scorers.presentContinuous()` and `scorers.noTrailingPeriod()`. |

## Prompt Evaluation Tools

The `tools/` directory contains a CLI for evaluating and optimizing the `topic.md` and `goal.md` prompts against test cases.

### Architecture

```
tools/
  prompt-eval.ts           → CLI entrypoint (topic | goal | topic-goal | optimize)
  suites/
    topic.suite.ts         → Test case loading + topic prompt builder + scorers
    goal.suite.ts          → Test case loading + goal prompt builder + scorers
  test-cases.json          → Basic 8-case test set
  test-cases-comprehensive.json → 50+ categorized cases
```

### Adding a new suite

1. Create `tools/suites/<name>.suite.ts`:
   - Define `TestCase` interface with `[key: string]: unknown`
   - Export `createSuite(testCasesFile?, promptPath?)` for static evaluation
   - Export `suiteFactory(testCasesFile?)` that returns `(promptText) => EvalSuite` for optimization
2. Wire into `tools/prompt-eval.ts` CLI

### Suite factory pattern

```typescript
// For optimization, the framework needs to rebuild the suite from raw prompt text
export function suiteFactory(testCasesFile = "test-cases.json"): (promptText: string) => EvalSuite<MyTestCase> {
  const testCases = loadTestCases(testCasesFile);
  return (promptText) => makeSuite(testCases, promptText);
}
```

### Key Invariants for Tools

1. **Prompt frontmatter preservation** — `loadPrompt()` strips `---
---` blocks for the LLM but the optimizer's `createCriticPrompt()` instructs the critic to preserve them.
2. **Suite factory must accept raw text** — `suiteFactory` takes `(promptText: string)` so `optimizeSuite` can inject revised prompts without filesystem I/O.
3. **Prompt paths are relative to `tools/`** — the CLI resolves `prompts/topic.md` against the package root, not `tools/`.


## Model Calling from Extensions

We call `@earendil-works/pi-ai` directly (not through Pi's agent loop):

```typescript
const model = registry.getAvailable().find(m => m.id === modelId);
const auth = await registry.getApiKeyAndHeaders(model);
const result = await completeSimple(
  model,
  { systemPrompt, messages: [{ role: "user", content: [{ type: "text", text: userText }], timestamp: Date.now() }] },
  {
    apiKey: auth.apiKey,
    headers: auth.headers || {},
    maxTokens: Math.min(128, promptFile.maxWords * 2 + 8),
    temperature: 0,
    ...thinkingOffOpts(model),
    onPayload: (payload: any) => { payload.response_format = { type: "json_object" }; return payload; },
  },
);
```

## Prompt File Format

```yaml
---
max_words: 4
---
Summarize the user's message as a concise topic label.

Message: {message}
```

- `max_words` is read by `readPromptFile()` and enforced by `truncateToWords()` post-generation
- `{message}` is supported in all prompts; `{goal}` is supported in `achievement.md`
- `{max_words}` is substituted in instructions before sending to the LLM
- Files live in `~/.pi/agent/extensions/pi-heading/prompts/` (user-editable)

## Testing

- **Unit tests**: `bun test` (112 tests across 7 files: `summarize.test.ts`, `summarize-pipeline.test.ts`, `picker.test.ts`, `guard.test.ts`, `store.test.ts`, `widget.test.ts`, `index.test.ts`)
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

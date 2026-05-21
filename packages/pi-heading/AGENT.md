---
parent: ../../AGENT.md
---

# AGENT.md — @alexleekt/pi-heading

> Behavioral rules for AI agents working on this codebase.

## Monorepo Context

This package lives inside the `pi-extensions` monorepo. See [`../../AGENT.md`](../../AGENT.md) for monorepo-wide conventions.

## Invariants (Never Break These)

1. **One line only** — `renderWidget()` must produce exactly one string. No borders, no background functions, no multi-line arrays.
2. **Never block the agent** — `before_agent_start` handler must fire summarize work as `void (async () => { ... })()` (fire-and-forget). Awaiting `summarize()` would stall the agent for 1-3 seconds.
3. **Passive widget** — No keyboard focus, no hotkeys, no `handleInput`. The widget is read-only.
4. **Prompt file frontmatter** — `readPromptFile()` parses YAML frontmatter for `max_words`. The regex must handle empty frontmatter (`---\n---\n`) and missing trailing newlines.
5. **Symlink-safe paths** — `import.meta.dirname` resolves to the symlink target (`~/.pi/agent/extensions/pi-heading/`), so `prompts/` is a sibling, NOT `../prompts`.
6. **Placeholder substitution** — `runPrompt()` replaces `{goal}` and `{max_words}` in both instructions and template before sending to the LLM.
7. **Model calling** — We call `@earendil-works/pi-ai` directly (not through Pi's agent loop). See `llm/summarize.ts` for the pattern.

## Critical Rules

### Prompt evaluation tools
When modifying prompts, run the evaluation suite before shipping:

```bash
bun tools/prompt-eval.ts topic
bun tools/prompt-eval.ts goal
```

The optimizer mutates prompt files in-place — **back up before running**.

### Suite factory pattern
When adding new evaluation suites, the factory must accept raw prompt text: `suiteFactory(testCasesFile?)` returns `(promptText: string) => EvalSuite`. This lets `optimizeSuite` inject revised prompts without filesystem I/O.

### Test scripts
Test scripts (`scripts/validate.ts`, `scripts/smoke-test.ts`, etc.) must use the **same escaping** as production code. If you add a new escape in `tool/ask-user.ts`, add it to all test scripts too.

## Extension-Specific Rules

- **Indentation:** 2 spaces (TypeScript)
- **Imports:** Use `.js` extensions on relative imports (NodeNext module resolution)
- **Console output:** Use `[pi-heading]` prefix for all `console.error`/`console.warn`
- **Peer deps:** `@earendil-works/pi-coding-agent` only. `pi-tui` is intentionally NOT used.
- **`noEmit` tsconfig** — Pi loads `.ts` files directly. Do NOT add `outDir` or `declaration` settings.

## Decision Making

| Scenario | Action |
|----------|--------|
| Modifying prompt files | Run `bun tools/prompt-eval.ts` first |
| Changing widget rendering | Proceed, but keep it one line only |
| Adding new prompt placeholders | Proceed, update `runPrompt()` substitution |
| Bug fixes with clear solution | Proceed |

## Deferred Work (Do Not Touch Without Discussion)

- Model validation on startup (ROADMAP item)
- Cheap-model filter for `/heading-model`

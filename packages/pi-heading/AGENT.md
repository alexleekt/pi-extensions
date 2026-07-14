---
parent: ../../AGENT.md
---

# Agent Guidelines — @alexleekt/pi-heading

## Monorepo context

Follow [`../../AGENT.md`](../../AGENT.md) for repository-wide workflow, formatting, and release rules.

## Invariants

1. **Use one native UI row.** Render goal and achievement text only through `ctx.ui.setWorkingMessage()`. Do not add a separate widget, custom achievement message, border, or multi-line panel.
2. **Let Pi own animation.** Do not add spinner timers or custom working-indicator frames.
3. **Never block the agent.** Topic, goal, and achievement summarization must remain fire-and-forget. Pass Pi's active `AbortSignal` to nested model calls.
4. **Finalize on `agent_settled`.** `agent_end` is a low-level boundary and may be followed by retry, compaction retry, or queued follow-up work.
5. **Preserve branch semantics.** State resolution must work after the leaf advances and after `session_tree` navigation. Persist through `pi.appendEntry("heading", state)`.
6. **Keep the display passive.** No keyboard focus, hotkeys, or input interception for the heading row.
7. **Keep prompt parsing defensive.** Support empty frontmatter, missing trailing newlines, `{message}`, `{goal}`, and `{max_words}` substitution.
8. **Resolve Pi paths through its API.** Use `getAgentDir()` instead of hardcoding `~/.pi/agent`.
9. **Keep sensitive diagnostics private.** Debug/config files must use user-only permissions. Debug logging remains opt-in and must never break the extension.

## Package rules

- Use `.js` extensions on relative TypeScript imports for NodeNext resolution.
- Pi loads source TypeScript directly; keep `tsconfig.json` typecheck-only.
- Declare Pi-provided packages in `peerDependencies`.
- Keep all transitive runtime imports in the npm `files` allowlist.
- Run `npm run pack-smoke` after changing package structure or dependencies.

## Validation

Run the complete gate before shipping:

```bash
npm run typecheck
npm test
npm run pack-smoke
```

When prompt files change, also run:

```bash
bun tools/prompt-eval.ts topic
bun tools/prompt-eval.ts goal
```

The prompt optimizer mutates files in place; back up prompts before using it.

After changing this `AGENT.md`, run:

```bash
agnix validate .
```

## Deferred work

Discuss before implementing roadmap items that change product ownership or UX, especially automatic session naming, startup model validation, model-list filtering, or multi-line rendering.

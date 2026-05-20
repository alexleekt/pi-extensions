# Design Journal Convention

## When to write one

Write a design journal when **both** are true:
- Session lasted >30 minutes OR touched architecture
- You made at least one non-obvious decision, found a bug with a surprising root cause, or reversed a previous decision

Skip it for: typo fixes, dependency bumps, mechanical refactors with no design trade-offs.

## Where to put it

```
packages/<pkg>/docs/session/YYYY-MM-DD-title.md
```

Keep session journals **inside the package they belong to** — not in a centralized wiki. They decay with the code; when the code changes, the journal is right there to update or archive.

## Template

```markdown
# Title — YYYY-MM-DD

## Session Goal
One sentence: what were we trying to achieve?

## Original Problem
What was broken / missing / unclear? Include a screenshot if visual.

## Key Decisions
For each decision, state:
1. The options considered
2. The chosen option
3. Why (the specific reason, not "it seemed better")

## Bugs Found & Fixed
For each bug:
- **Symptom:** what the user saw
- **Root cause:** the actual mechanism
- **Fix:** what changed
- **Prevention:** what would have caught it earlier (test, lint, doc)

## Architecture Learned
Any new understanding of the system we're building on? (e.g., "pi-tui differential rendering model")

## Documentation Updated
Which files changed and why.
```

## Relationship to other docs

| Doc | Scope | When updated |
|-----|-------|-------------|
| **Session journal** | One session's narrative | After the session |
| **ADR** (`docs/adr/`) | One hard-to-reverse decision | When the decision is made |
| **CONTEXT.md** | Project glossary | When terminology is resolved |
| **AGENT.md** | AI agent behavioral rules | When invariants change |
| **Memex card** | Atomic insight, cross-project | After any task with non-obvious learning |

## Automation helpers

- **Quest system:** Use `quest` to track session steps. The quest log becomes a rough outline for the journal.
- **Vent system:** Log repeated friction. If the same workaround appears twice, it belongs in the journal's "Prevention" section.
- **Before/after code blocks:** When explaining a bug fix, always show the broken code and the fixed code.

---
name: session-heading
description: Guidelines for using the session heading to stay focused. Use when the user asks about the session heading, or when you need to check the current goal or understand heading conventions.
---

# Session Heading

The session heading tracks the current goal. It is visible in the UI and injected into the system prompt so you can stay focused.

## Actions (via heading tool)

| Action | Behavior |
|--------|----------|
| `get` | Retrieve the current heading (topic, goal, achievement). |
| `skill` | Return this documentation. |

## Rules

- The heading is a concise statement of the current goal.
- When the user shifts topic, update the heading.
- Always check the heading before planning multi-step actions.
- If the heading is stale (unchanged for many turns while the topic drifts), update it.
- Keep the current heading in view when the user continues work on a stated goal.

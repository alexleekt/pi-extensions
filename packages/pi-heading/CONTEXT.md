# CONTEXT — pi-heading

## Glossary

| Term | Definition |
|------|------------|
| **Topic** | A stable 2–4 word label derived from the user's current task. Exposed to other extensions for grouping and pane naming. |
| **Goal** | A concise statement of the current intent, shown through Pi's native working-message row while the agent runs. |
| **Achievement** | A past-tense summary generated from the final assistant turn and shown in the same working-message row after completion. |
| **Heading entry** | A `pi.appendEntry("heading", state)` custom entry. It persists state without adding content to the model context. |
| **Transient heading** | In-memory placeholder or summary state attached to an entry while asynchronous summarization is still running. |
| **Branch replay** | Resolution of the newest transient or persisted heading on the active session branch, including after `/tree` navigation. |
| **Settled run** | Pi's `agent_settled` point, when no retry, compaction retry, or queued follow-up remains. |
| **Working message** | Pi's built-in `ctx.ui.setWorkingMessage()` surface. It is the only surface used to display goal and achievement text. |
| **Heading exposure** | A `heading:state` event with `{ topic, goal, achievement?, mode }` for passive extension composition. |
| **Debug mode** | Opt-in structured logging of prompts, user input, responses, and errors to a user-private file under Pi's agent directory. |

## Boundaries

- **One line only.** No bordered panels, custom widgets, or multi-row history.
- **Native indicator only.** Pi owns loader animation through its working indicator; pi-heading supplies text only.
- **No transcript duplication.** Achievements stay in the working message and persisted custom state, not custom chat messages.
- **Non-blocking.** Topic, goal, and achievement calls are fire-and-forget and receive Pi's active `AbortSignal`.
- **Branch-aware.** Session resume and `/tree` navigation replay the selected branch's latest persisted heading.
- **Passive integration.** Other extensions consume `heading:state`; pi-heading has no direct multiplexer dependency.

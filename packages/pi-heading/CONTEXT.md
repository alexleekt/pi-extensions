# CONTEXT — pi-heading

## Glossary

| Term | Definition |
|------|------------|
| **Topic** | A 2-4 word label derived from the user's last message. Used for pane naming, branch labeling, and quick visual grouping. Kept stable across turns unless the conversation clearly changes subject. |
| **Goal** | A one-sentence description of what the user is currently trying to achieve, displayed above the editor. Rewritten after every user message. Reuses the user's exact terminology. |
| **Heading entry** | A `pi.appendEntry("heading", { topic, goal })` persisted per branch. Survives session restarts, visible in the conversation tree. |
| **Prompt file** | A markdown file with YAML frontmatter containing the LLM prompt template plus a `max_words` constraint. Two prompt files: one for topic derivation, one for goal derivation. User-editable, extension-reloads on `/reload` or restart. |
| **Topic guard** | A deterministic string-similarity filter that prevents the topic from jittering between semantically-equivalent labels ("docker setup" vs "docker config"). Preserves original capitalization of proper nouns. |
| **Widget line** | The single-line string rendered above the editor via `ctx.ui.setWidget()`. Plain text, no borders, no pi-tui components. |

## Boundaries

- **One line only.** No bordered panels, no multi-row history, no keyboard focus, no animations.
- **Passive display.** The widget never intercepts input. There are no hotkeys for the widget itself.
- **Per-branch state.** Topic and goal are scoped to the current branch via `appendEntry`. Switching branches restores that branch's heading.

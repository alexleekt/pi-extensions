# Prompts Directory

This directory contains the default prompts that define how the agent uses `ask_user` and the YOLO mandate that modifies agent behavior.

## Files

| File | Purpose | Injected Where |
|------|---------|---------------|
| `ask-user.md` | Tool description, prompt snippet, and guidelines | `defineTool()` in `index.ts` |
| `yolo-mandate.md` | YOLO style mandate | `before_agent_start` hook in `index.ts` |

## User Overrides

You can customize these prompts by pointing to individual files via the settings file.

Run `/ask-user-config` in Pi and select **"Set ask-user prompt file"** or **"Set yolo mandate file"** to point to any `.md` file on your filesystem:

```
/home/you/prompts/my-ask-user.md   ← replaces ask-user.md
/home/you/prompts/my-yolo.md       ← replaces yolo-mandate.md
```

Changes are read at runtime — no rebuild needed.

## Format: ask-user.md

The file is parsed into sections:

- `## Snippet` — short one-liner used as `promptSnippet` in `defineTool()`
- `## Description` — the full tool description shown to the agent (mandate + trigger conditions + examples + formatting helpers)
- `## Rules` — numbered list of behavioral rules, each becomes a `promptGuidelines` entry

**Note:** The section header is `## Rules` (not `## Guidelines`). The prompt loader strips `1. ` prefixes and extracts each line as a separate guideline string.

## Format: yolo-mandate.md

The file is parsed into sections:

- `## Text` — the exact mandate text injected into the system prompt

The YOLO mandate is a **style guide** for how to ask (concise, recommend-first, skippable), not a ban on asking. It should NOT contradict the ask_user prompt.

Everything else is treated as documentation and ignored.

## Settings File

Settings are stored in `~/.pi/agent/pi-ask-user-glimpse.json`:

```json
{
  "askUserPrompt": "/path/to/your/ask-user.md",
  "yoloMandatePrompt": "/path/to/your/yolo-mandate.md"
}
```

Use `/ask-user-config` in Pi to edit this file interactively.

### Priority

1. **Individual file path** from settings (`askUserPrompt` / `yoloMandatePrompt`)
2. **Bundled prompts** (shipped with the extension)
3. **Hardcoded fallbacks** (never breaks)

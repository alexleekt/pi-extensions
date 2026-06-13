# Prompts Directory

This directory contains the bundled prompt that defines how the agent sees the `ask_user` tool.

## Files

| File | Purpose | Used Where |
|------|---------|------------|
| `ask-user.md` | Tool description, prompt snippet, and guidelines | `defineTool()` in `index.ts` |

The extension is intentionally a dialog renderer. It no longer injects agent-behavior policy prompts such as YOLO/ask-style mandates.

## Format: ask-user.md

The file is parsed into sections:

- `## Snippet` — short one-liner used as `promptSnippet` in `defineTool()`
- `## Description` — the full tool description shown to the agent
- `## Guidelines` — numbered list of behavioral rules, each becomes a `promptGuidelines` entry

Everything else is treated as documentation and ignored.

## Legacy override

For backwards compatibility, `~/.pi/agent/pi-ask-user-glimpse.json` may contain an `askUserPrompt` path that overrides the bundled `ask-user.md`. There is no slash-command UI for editing this file; normal users should use the bundled prompt.

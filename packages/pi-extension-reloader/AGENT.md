# Agent Guidelines

## Communication Style
- Be direct and to the point
- This is a developer-tool extension; accuracy matters more than polish

## Code Conventions
- Follow existing patterns in `pi-bump` and `pi-ask-user-glimpse` for consistency
- Use TypeScript with strict types; avoid `any`
- Prefer synchronous file operations where async adds no value

## Workflow Rules
- Run `npm run check` (tsc --noEmit) before committing
- Keep the extension as a single `index.ts` file — no build step needed
- Test `/rebuild-extension` against a real symlinked extension before declaring done

## Tool Usage
- Use `Edit` tool for precise changes to `index.ts`
- Use `Bash` for file operations and verification
- Keep jiti cache discovery logic robust — it runs on every user machine with different temp paths

# Testing @alexleekt/pi-heading

## Automated gate

```bash
npm run typecheck
npm test
npm run pack-smoke
```

The packed-import smoke test verifies that the npm artifact contains every transitive runtime module, excludes tests, installs with declared peers, and loads through Pi's jiti TypeScript loader.

## Local extension setup

```text
~/.pi/agent/extensions/pi-heading -> ~/git/pi-extensions/packages/pi-heading
~/.pi/agent/node_modules -> ~/git/pi-extensions/node_modules
```

After retargeting a symlink, clear Pi's jiti cache if `/reload` still uses stale code:

```bash
rm -rf /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/.cache/jiti/
```

## Manual checks

1. Start Pi and verify `@alexleekt/pi-heading` appears in the extension list.
2. Send `help me set up docker for this project`.
   - The working row immediately shows the prompt placeholder.
   - Within a few seconds it changes to a concise goal.
   - Pi's native spinner remains the only animation.
3. Complete a tool-using task.
   - Intermediate tool turns keep the goal.
   - The final text turn changes to an achievement.
   - No custom achievement message is added to the transcript.
4. Use `/tree` to select a branch with a different task.
   - The selected branch's latest goal or achievement is restored.
5. Run `/heading` and enter a manual goal.
6. Run `/heading-model`, select another model, then reset to the session model.
7. Run `/heading-debug on`, send a message, inspect `/heading-debug`, then run `/heading-debug clear` and `/heading-debug off`.
   - Treat the debug log as sensitive because it contains full prompts and input.
8. Resize the terminal and inspect scrollback.
   - The one-line native working message should not leave border fragments or duplicate cards.

## Troubleshooting

- **No heading:** Run `/heading` to isolate UI from model/auth failures.
- **Summarization error:** Use `/heading-debug on`, reproduce once, then inspect `/heading-debug`.
- **Wrong branch heading:** Navigate with `/tree`; `session_tree` should replay the branch's newest `heading` custom entry.
- **Stale extension code:** Clear jiti cache and restart Pi.
- **Package works locally but not from npm:** Run `npm run pack-smoke`; do not rely on `npm pack --dry-run` alone.

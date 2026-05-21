# Testing @alexleekt/pi-heading

## Prerequisites

The extension is already symlinked into pi:
```
~/.pi/agent/extensions/pi-heading -> ~/git/pi-extensions/packages/pi-heading
~/.pi/agent/node_modules -> ~/git/pi-extensions/node_modules
```

If you moved/retargeted symlinks, clear jiti cache:
```bash
rm -rf /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/.cache/jiti/
```

## Test Steps

### 1. Start a fresh pi session
```bash
pi
```

### 2. Verify the extension loaded
Look for `@alexleekt/pi-heading` in the startup extension list. If missing, check:
```bash
cat ~/.pi/agent/extensions/pi-heading/package.json
```

### 3. Send a test message
Type anything and press Enter:
```
help me set up docker for this project
```

**Expected:** Within 1-3 seconds, a single line appears above the editor:
```
▸ Help me set up docker for this project
```
(or an LLM-summarized variant like `▸ Docker project setup`)

### 4. Send a second message
```
actually i want to use kubernetes instead
```

**Expected:** The goal line updates. The topic might stay stable if it's still "Docker/K8s setup".

### 5. Test `/heading` override
Type `/heading` and enter a custom heading:
```
Migrating from Docker to Kubernetes
```

**Expected:** Widget immediately shows `▸ Migrating from Docker to Kubernetes`.

### 6. Test `/heading-model`
Type `/heading-model` and pick a different model (or "Reset to session model").

**Expected:** Notification confirms the change.

### 7. Test `/heading-debug`
Type `/heading-debug on` to enable debug logging. Send another message, then type `/heading-debug` (no arguments) to view the last entries.

**Expected:** A notification shows recent debug entries with timestamps, goal text, and model IDs.

Type `/heading-debug off` to disable logging, and `/heading-debug clear` to wipe the log.

### 8. Ghosting check
Resize the terminal window (make it narrower, then wider).

**Expected:** No stacked border fragments. The single line may re-wrap but there's nothing to orphan.

### 8. Scrollback check
Scroll up with your mouse/trackpad.

**Expected:** You see your conversation history. The heading widget is NOT in scrollback — it only lives in the active viewport.

## Debugging

If the widget doesn't appear:

1. Enable debug mode and inspect the log:
   ```
   /heading-debug on
   ```
   Send a message, then:
   ```
   /heading-debug
   ```
   Look for `❌` errors or `⚠️FRONTMATTER_LEAK` warnings in the output.

2. Check the prompt files were bootstrapped:
   ```bash
   ls ~/.pi/agent/extensions/pi-heading/prompts/
   ```
   Should show `topic.md`, `goal.md`, and `achievement.md`.

3. Check pi's debug log for errors:
   ```bash
   grep "pi-heading" ~/.pi/agent/logs/*.log 2>/dev/null || echo "no log dir"
   ```

4. Check if the model call failed (e.g., no API key):
   The error is caught and logged to stderr. Look for `[pi-heading] Summarize failed:`.

5. Try setting a manual heading first to verify the widget mechanism works:
   ```
   /heading Test heading
   ```
   If this works but auto-summarize doesn't, the issue is the LLM call (model/auth).

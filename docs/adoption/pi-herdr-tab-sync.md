# Adoption Plan: `pi-herdr-tab-sync`

## Source
- **Upstream**: https://github.com/justcyl/pi-herdr-tab-sync
- **License**: MIT
- **Scope**: Simple (~70 LOC) pi extension — syncs pi session name to herdr tab label

---

## What It Does

| Trigger | Action |
|---------|--------|
| `session_start` (`/resume`) | If session has a name, renames herdr tab immediately |
| `agent_start` | If session name changed (e.g. after `/name`), updates herdr tab |
| No session name | No-op — tab stays as-is |

Only activates inside herdr-managed panes (`HERDR_ENV=1`).

---

## Current State Assessment

### ✅ Already in Place
- **herdr installed**: v0.5.10 at `~/.local/bin/herdr`
- **HERDR env vars active**: `HERDR_ENV=1`, `HERDR_SOCKET_PATH`, `HERDR_PANE_ID`
- **herdr-agent-state.ts**: Already in `~/.pi/agent/extensions/` — herdr's built-in pi integration for agent state reporting
- **pi-extensions monorepo**: Established at `~/git/pi-extensions/packages/`
- **Symlink pattern**: Extensions symlinked from monorepo to `~/.pi/agent/extensions/`

### ⚠️ Changes Required for Adoption

| Item | Upstream | Our Setup |
|------|----------|-----------|
| Import path | `@mariozechner/pi-coding-agent` | `@earendil-works/pi-coding-agent` |
| Package scope | `pi-herdr-tab-sync` | `@alexleekt/pi-herdr-tab-sync` |
| Monorepo | Standalone repo | `~/git/pi-extensions/packages/` |
| TypeScript config | N/A (no tsconfig) | Inherits `../tsconfig.base.json` |
| Peer deps | None | `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui` |

---

## Adoption Strategy: **Copy & Adapt into Monorepo**

Don't fork/subtree — the repo is tiny (~70 LOC), single-file, and MIT-licensed. Creating a new package in our monorepo is cleanest.

### Step 1: Create Package Directory

```bash
mkdir -p ~/git/pi-extensions/packages/pi-herdr-tab-sync
```

### Step 2: Write `package.json`

```json
{
  "name": "@alexleekt/pi-herdr-tab-sync",
  "version": "1.0.0",
  "description": "Sync pi session name to herdr tab label. Only activates inside herdr-managed panes.",
  "type": "module",
  "license": "MIT",
  "author": "Alex Lee <657215+alexleekt@users.noreply.github.com>",
  "keywords": [
    "pi-package",
    "pi-extension",
    "pi",
    "herdr",
    "tab",
    "sync"
  ],
  "files": [
    "index.ts",
    "README.md",
    "LICENSE"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/alexleekt/pi-extensions.git"
  },
  "publishConfig": {
    "access": "public"
  },
  "homepage": "https://github.com/alexleekt/pi-extensions/tree/main/packages/pi-herdr-tab-sync#readme",
  "bugs": {
    "url": "https://github.com/alexleekt/pi-extensions/issues"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "pi": {
    "extensions": ["./index.ts"]
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-tui": "*"
  },
  "devDependencies": {
    "@earendil-works/pi-coding-agent": "^0.74.0",
    "typescript": "^5.9.3"
  },
  "scripts": {
    "check": "tsc --noEmit"
  }
}
```

### Step 3: Write `tsconfig.json`

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "."
  },
  "include": ["index.ts"]
}
```

### Step 4: Write `index.ts` (Adapted)

Key changes from upstream:
1. Import path: `@mariozechner/pi-coding-agent` → `@earendil-works/pi-coding-agent`
2. Keep all logic identical — no functional changes needed

```typescript
// pi-herdr-tab-sync: sync pi session name → herdr tab label
// Only activates inside herdr-managed panes (HERDR_ENV=1).
// Triggers on: session_start (resume), agent_start (picks up /name changes).
// Does nothing if the session has no name.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createConnection } from "node:net";

const HERDR_ENV = process.env.HERDR_ENV;
const socketPath = process.env.HERDR_SOCKET_PATH;
const paneId = process.env.HERDR_PANE_ID;

function enabled() {
  return HERDR_ENV === "1" && !!socketPath && !!paneId;
}

function herdrRequest(method: string, params: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    let done = false;
    let buf = "";
    const finish = (result: Record<string, unknown> | null = null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };

    const socket = createConnection(socketPath!);
    socket.on("error", () => finish());
    socket.on("connect", () => {
      const id = `pi-herdr-tab:${Date.now()}`;
      socket.write(`${JSON.stringify({ id, method, params })}\n`);
    });
    socket.on("data", (chunk) => {
      buf += chunk.toString();
      if (buf.includes("\n")) {
        try {
          const resp = JSON.parse(buf.split("\n")[0]);
          finish(resp.result ?? null);
        } catch {
          finish();
        }
      }
    });
    socket.on("end", () => finish());
    const timer = setTimeout(() => finish(), 1000);
    timer.unref?.();
  });
}

async function renameTab(label: string): Promise<void> {
  const result = await herdrRequest("pane.get", { pane_id: paneId! });
  const tabId = (result as { pane?: { tab_id?: string } })?.pane?.tab_id;
  if (!tabId) return;
  await herdrRequest("tab.rename", { tab_id: tabId, label });
}

export default function (pi: ExtensionAPI) {
  if (!enabled()) return;

  let lastSynced: string | undefined;

  function sync() {
    const name = pi.getSessionName();
    if (!name || name === lastSynced) return;
    lastSynced = name;
    void renameTab(name);
  }

  pi.on("session_start", () => sync());
  pi.on("agent_start", () => sync());
}
```

### Step 5: Write `README.md`

```markdown
# @alexleekt/pi-herdr-tab-sync

Sync pi session name to [herdr](https://herdr.dev) tab label.

## Behavior

- On **session resume** (`/resume`): if the session has a name, the herdr tab is renamed immediately.
- On **agent start**: if the session name changed (e.g. after `/name`), the herdr tab is updated.
- If the session has **no name**, nothing happens — the tab label stays as-is.

Only activates inside herdr-managed panes (`HERDR_ENV=1`).

## Install

```shell
ln -s ~/git/pi-extensions/packages/pi-herdr-tab-sync ~/.pi/agent/extensions/pi-herdr-tab-sync
```

Then `/reload` in pi or restart.

## License

MIT. Originally derived from [justcyl/pi-herdr-tab-sync](https://github.com/justcyl/pi-herdr-tab-sync).
```

### Step 6: Write `LICENSE`

Copy upstream MIT license, add attribution line.

### Step 7: Symlink and Register

```bash
# Create symlink into pi's extensions directory
ln -s ~/git/pi-extensions/packages/pi-herdr-tab-sync ~/.pi/agent/extensions/pi-herdr-tab-sync

# Type-check
cd ~/git/pi-extensions/packages/pi-herdr-tab-sync
npm install  # pulls dev deps
npm run check

# In pi:
/reload
```

### Step 8: Commit

```bash
cd ~/git/pi-extensions
yadm add packages/pi-herdr-tab-sync/
yadm commit -m "feat: add pi-herdr-tab-sync extension"
```

---

## Optional Enhancements (Post-Adoption)

1. **Debug command**: Uncomment the `pi.registerCommand("herdr-debug", ...)` block for troubleshooting
2. **Debounce**: If rapid `/name` changes cause flicker, add a small debounce to `sync()`
3. **Fallback label**: If no session name, optionally sync project directory name or git branch

---

## Compatibility Matrix

| Component | Version | Status |
|-----------|---------|--------|
| herdr | 0.5.10 | ✅ Tested & active |
| pi-coding-agent | 0.74.0+ | ✅ `getSessionName()` available |
| pi-tui | * | ✅ Peer dependency |
| Node.js | 18+ | ✅ Required by monorepo |

---

## Open Questions

1. Should we publish to npm as `@alexleekt/pi-herdr-tab-sync`, or keep internal-only?
2. Should the debug command be enabled by default or behind an env var?
3. Do we want to merge this functionality into `herdr-agent-state.ts` instead of a separate extension?

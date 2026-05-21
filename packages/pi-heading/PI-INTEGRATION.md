# Integrating with pi-heading

pi-heading broadcasts its current heading state on the shared Pi `EventBus` so other extensions can react to what the user is working on — without coupling to herdr, tmux, or any specific multiplexer.

## What you get

Subscribe to the `heading:state` channel on `pi.events`:

```typescript
pi.events.on("heading:state", (payload) => {
  const { topic, goal, achievement, mode } = payload;
  // do something useful
});
```

### Payload shape

```typescript
interface HeadingExposure {
  topic: string;        // 2-4 word label, stable across turns (e.g. "docker")
  goal: string;         // one-sentence description of current intent
  achievement?: string; // what the agent accomplished last turn (undefined if none yet)
  mode: "goal" | "working" | "achievement" | "idle";
}
```

### Mode semantics

| Mode | When it fires | What it means |
|------|--------------|---------------|
| `goal` | After the user sends a message and the goal is summarized | The agent is about to start working on this goal |
| `working` | When the agent loop starts, and at the start of each tool-call turn | The agent is actively executing |
| `achievement` | After a turn completes and the achievement is summarized | The agent finished that turn; check `achievement` for what got done |
| `idle` | When the overall agent run ends | The agent is idle, waiting for the next user message |

A `clearExposure()` (empty topic/goal, mode `idle`) will fire on `session_shutdown` so consumers can clean up any transient UI they built.

## When events fire

```
session_start  → exposeHeading(replayedState,  "achievement" | "goal")
before_agent_start → exposeHeading(newState,   "goal" | "working")
agent_start    → exposeHeading(currentState,    "working")
turn_start     → exposeHeading(currentState,    "working")
turn_end       → exposeHeading(stateWithAch,    "achievement")
agent_end      → clearExposure()
session_shutdown → clearExposure()
/heading cmd   → exposeHeading(manualState,     "goal")
```

## Minimal consumer example

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.events.on("heading:state", (payload) => {
    const { topic, goal, mode } = payload as {
      topic: string;
      goal: string;
      achievement?: string;
      mode: string;
    };

    if (!topic && !goal) {
      // clearExposure — session ended or no state
      pi.ui.setStatus("my-ext", undefined);
      return;
    }

    const prefix =
      mode === "working" ? "⚡" :
      mode === "achievement" ? "✓" :
      "▸";

    pi.ui.setStatus("my-ext", `${prefix} ${topic}: ${goal}`);
  });
}
```

## Use-case ideas

- **Pane title sync** — map `topic` to `ctx.ui.setTitle()` or your multiplexer equivalent
- **Status bar** — show `topic` + truncated `goal` in a custom footer
- **Dashboard feed** — collect `heading:state` events across panes and render a project-overview sidebar
- **Build trigger** — when `mode === "achievement"` and `topic === "deploy"`, kick a CI job

## Design philosophy

- **Pi-heading will not know you exist.** It will just broadcast. No callbacks, no registries, no coupling.
- **Best effort.** The event bus is in-process; if your extension loads after pi-heading, you'll still receive all future events.
- **Not a log.** Only the *latest* state will be emitted. If you need history, track it yourself in your extension.

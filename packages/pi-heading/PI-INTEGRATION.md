# Integrating with pi-heading

pi-heading broadcasts current state on Pi's shared event bus so other extensions can react without importing pi-heading or coupling it to a terminal multiplexer.

## Subscribe

```typescript
pi.events.on("heading:state", (payload) => {
    const { topic, goal, achievement, mode } = payload as {
        topic: string;
        goal: string;
        achievement?: string;
        mode: "goal" | "working" | "achievement" | "idle";
    };
});
```

## Payload

| Field | Meaning |
|-------|---------|
| `topic` | Stable 2–4 word task label |
| `goal` | Current intent |
| `achievement` | Latest completed result, when available |
| `mode` | Current lifecycle state |

### Mode semantics

| Mode | Emitted when |
|------|--------------|
| `goal` | A goal is ready or a settled run has no achievement |
| `working` | The agent starts or begins another tool-call turn |
| `achievement` | Final-turn achievement summarization completes, or a saved achievement is replayed |
| `idle` | No branch state exists or the session shuts down |

`agent_settled` does not emit `idle`; it preserves the final goal or achievement. This matters because `agent_end` can be followed by retries, compaction retries, or queued follow-ups.

## Event flow

```text
session_start / session_tree → replay selected branch
before_agent_start           → goal or working
agent_start / turn_start      → working
turn_end with tool results    → unchanged; no achievement call
turn_end without tool results → achievement when summary completes
agent_settled                 → preserve final goal or achievement
session_shutdown              → idle
/heading                      → goal
```

Duplicate payloads are suppressed.

## Consumer example

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
    pi.events.on("heading:state", (raw) => {
        const state = raw as {
            topic: string;
            goal: string;
            achievement?: string;
            mode: string;
        };

        if (state.mode === "idle") {
            return;
        }

        // Feed a pane-title bridge, dashboard, or status integration.
        console.log(`${state.topic}: ${state.achievement ?? state.goal}`);
    });
}
```

## Design contract

- Events are best-effort and in-process.
- The channel represents latest state, not an event history.
- Consumers own their rendering and persistence.
- pi-heading never calls consumer-specific APIs.

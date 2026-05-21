# Always-On & YOLO Mode

> This document describes how `pi-ask-user-glimpse` controls whether the agent asks questions via `ask_user` or proceeds autonomously.
> The behavior is **merged into the main extension** — no separate middleware file is needed.

## The Problem

Some skills (like `grill-with-docs`) instruct the agent to "ask the questions one at a time, waiting for feedback on each question before continuing." However, they never tell the agent to **use a tool** for this — the agent defaults to writing questions as free-form assistant text. Because no `ask_user` tool call is made, `pi-ask-user-glimpse` never activates.

## Why You Can't Intercept the Assistant Message

Pi extensions cannot convert a **completed assistant text message** into a tool call. The lifecycle is one-way:

1. LLM generates assistant message (text + optional tool calls)
2. `message_end` fires — you can **replace** the message, but the replacement must keep the same `role`
3. If the message was text, it stays text. You cannot retroactively turn it into a `tool_call`.

Therefore, the only reliable way to force tool usage is to influence the LLM **before** generation — via prompt injection.

## Style Modes

The main extension (`index.ts`) hooks `before_agent_start` and injects a system-prompt mandate based on the current style mode. The mode is persisted per-session via `pi.appendEntry("ask-user-style", { mode: "always" | "plain" | "yolo" })`.

### Always Dialog *(default)*

Injects the standard mandate:

> "When you need to ask the user a question, you MUST use the `ask_user` tool. Do NOT write questions as free-form assistant text."

### Plain Text

No mandate is injected. The agent writes questions as free-form assistant text (bypassing the rich WebView dialog).

### YOLO

Injects the YOLO mandate:

> "You are in YOLO mode. Do NOT ask the user for input or confirmation. Go with your best recommendation and proceed immediately. Only use `ask_user` if the action would cause irreversible harm, data loss, security compromise, or violate explicit hard constraints."

### Manual override: `/ask-style`

Cycles through the three states:

Cycles through three states:
- **Always Dialog** *(default)* — always inject the `ask_user` mandate
- **Plain Text** — disable all dialog injection
- **YOLO** — never ask; the agent proceeds with its best recommendation

The mandate for the active mode is appended to the system prompt on every turn (when `ask_user` is in the tool set).

## How It Works

1. Hook `before_agent_start` — fires before the LLM sees the prompt.
2. Verify `ask_user` is in `selectedTools` (safety check).
3. Read the current style mode from the session journal.
4. Append the appropriate mandate (or nothing, for Plain Text).

## Pros

- **Skill-agnostic** — works regardless of whether a named skill is loaded.
- **User-controllable** — `/ask-style` cycles through three modes on demand.
- **Zero round-trips** — no extra LLM calls needed.

## Cons

- The LLM could theoretically ignore the mandate, though in practice system-prompt overrides are highly effective.
- YOLO mode trades safety for speed — use it only when you trust the agent's judgment.

## Legacy: Separate Middleware File

Earlier versions shipped a standalone `grill-with-docs-middleware.ts` companion extension. This has been **removed** — the logic is now unified in the main extension. If you previously installed the middleware separately, you can delete it from `~/.pi/agent/extensions/`.

## Fallback: `input` Event Transform

**File:** [`grill-with-docs-input-transform.ts`](./grill-with-docs-input-transform.ts)

This is an *example* of an alternative approach, not a recommended one. It hooks the `input` event and regex-matches the raw user input. It is fragile and consumes user-message tokens, but works when content is pasted manually without being loaded as a named skill. Use `/ask-style` instead.

## Decision Matrix

| Approach | Detects Reliably | Forces Tool Usage | Extra Round-trip | Token Cost | Status |
|----------|------------------|-------------------|------------------|------------|--------|
| Always Dialog (`before_agent_start`) | ✅ Always | ✅ System prompt | ❌ No | Low (~100 chars) | **Active** |
| `/ask-style` Plain Text | ✅ Always | ❌ None | ❌ No | Zero | **Active** |
| `/ask-style` YOLO | ✅ Always | ✅ System prompt | ❌ No | Low (~100 chars) | **Active** |
| `input` transform (example) | ⚠️ Regex | ✅ Injected text | ❌ No | Medium | Legacy example |
| `message_end` post-hoc hack | ❌ Post-hoc | ❌ Hope-based | ✅ Yes | High | Not implemented |

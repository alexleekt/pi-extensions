# Auto-Detection: Question-Session Detection

> This document describes the built-in detection logic in `pi-ask-user-glimpse`.
> As of the latest version, this behavior is **merged into the main extension**
> and activates automatically. You do not need to install a separate middleware file.

## The Problem

Some skills (like `grill-with-docs`) instruct the agent to "ask the questions one at a time, waiting for feedback on each question before continuing." However, they never tell the agent to **use a tool** for this — the agent defaults to writing questions as free-form assistant text. Because no `ask_user` tool call is made, `pi-ask-user-glimpse` never activates.

## Why You Can't Intercept the Assistant Message

Pi extensions cannot convert a **completed assistant text message** into a tool call. The lifecycle is one-way:

1. LLM generates assistant message (text + optional tool calls)
2. `message_end` fires — you can **replace** the message, but the replacement must keep the same `role`
3. If the message was text, it stays text. You cannot retroactively turn it into a `tool_call`.

Therefore, the only reliable way to force tool usage is to influence the LLM **before** generation — via prompt injection.

## Built-in Detection

The main extension (`index.ts`) hooks `before_agent_start` and auto-detects question sessions using three signals:

### 1. Known question-oriented skills

Checks `systemPromptOptions.skills` for:
- `grill-with-docs`
- `questionnaire`
- `interview`
- `grill`

### 2. Language patterns in the system prompt

Regex patterns such as:
- "ask the questions one at a time"
- "interview me"
- "grilling session"
- "wait for feedback"
- "questionnaire mode"
- "one question per call"

### 3. Manual override: `/ask-style`

Overrides auto-detection for the current session. Persisted via `pi.appendEntry("ask-user-style", { enabled: boolean | null })`.

Cycles through three states:
- **AUTO** *(default)* — auto-detect by skill name + language patterns
- **Always Dialog** — always use `ask_user` for every question
- **Plain Text** — disable all dialog injection

When any signal triggers, the extension appends a mandate to the system prompt:

> "When you need to ask the user a question, you MUST use the `ask_user` tool. Do NOT write questions as free-form assistant text."

## How It Works

1. Hook `before_agent_start` — fires before the LLM sees the prompt.
2. Verify `ask_user` is in `selectedTools` (safety check).
3. Check the three signals above.
4. If any match, append the mandate to the system prompt.

## Pros

- **Skill-agnostic** — works for any skill or prompt template that uses question-session language.
- **Non-invasive** — only appends tokens when detection triggers.
- **User-controllable** — `/ask-style` overrides auto-detection.
- **Zero round-trips** — no extra LLM calls needed.

## Cons

- If content is pasted anonymously (bypassing `systemPromptOptions.skills` and not matching regex patterns), detection fails. Use `/ask-style` as a manual override, or `/ask` to retroactively answer a question the agent already wrote as plain text.
- The LLM could theoretically ignore the mandate, though in practice system-prompt overrides are highly effective.

## Legacy: Separate Middleware File

Earlier versions shipped a standalone `grill-with-docs-middleware.ts` companion extension. This has been **removed** — the logic is now unified in the main extension. If you previously installed the middleware separately, you can delete it from `~/.pi/agent/extensions/`.

## Fallback: `input` Event Transform

**File:** [`grill-with-docs-input-transform.ts`](./grill-with-docs-input-transform.ts)

This is an *example* of an alternative approach, not a recommended one. It hooks the `input` event and regex-matches the raw user input. It is fragile and consumes user-message tokens, but works when content is pasted manually without being loaded as a named skill. Use `/ask-style` instead.

## Decision Matrix

| Approach | Detects Reliably | Forces Tool Usage | Extra Round-trip | Token Cost | Status |
|----------|------------------|-------------------|------------------|------------|--------|
| Built-in `before_agent_start` | ✅ Skills + patterns | ✅ System prompt | ❌ No | Low (~100 chars) | **Active** |
| `/ask-style` manual toggle | ✅ Always | ✅ System prompt | ❌ No | Low (~100 chars) | **Active** |
| `input` transform (example) | ⚠️ Regex | ✅ Injected text | ❌ No | Medium | Legacy example |
| `message_end` post-hoc hack | ❌ Post-hoc | ❌ Hope-based | ✅ Yes | High | Not implemented |

# Middleware: Auto-convert grill-with-docs questions to `ask_user`

## The Problem

The `grill-with-docs` skill instructs the agent to "ask the questions one at a time, waiting for feedback on each question before continuing." However, it never tells the agent to **use a tool** for this — the agent defaults to writing questions as free-form assistant text. Because no `ask_user` tool call is made, `pi-ask-user-glimpse` never activates.

## Why You Can't Intercept the Assistant Message

Pi extensions cannot convert a **completed assistant text message** into a tool call. The lifecycle is one-way:

1. LLM generates assistant message (text + optional tool calls)
2. `message_end` fires — you can **replace** the message, but the replacement must keep the same `role`
3. If the message was text, it stays text. You cannot retroactively turn it into a `tool_call`.

Therefore, middleware must influence the LLM **before** generation — via prompt injection.

## Approach A: `before_agent_start` + System Prompt Injection (Recommended)

**File:** [`grill-with-docs-middleware.ts`](./grill-with-docs-middleware.ts)

### How it works

1. Hook `before_agent_start` — fires after user submits a prompt, before the LLM sees it.
2. Check `systemPromptOptions.skills` for `grill-with-docs`.
3. If active, append a mandate to the system prompt: "You MUST use `ask_user` for every question."
4. Also verify `ask_user` is in `selectedTools` so we don't break sessions where the tool is missing.

### Pros

- **Reliable** — detects the skill via Pi's structured metadata, not regex on user text.
- **Non-invasive** — only activates when the skill is loaded.
- **Tool-aware** — checks that `ask_user` exists before mandating its use.

### Cons

- If the skill is invoked anonymously (e.g., copied inline into the prompt without being loaded as a named skill), it won't be detectable via `systemPromptOptions.skills`.
- The LLM could theoretically ignore the mandate (though in practice system-prompt overrides usually work).

### Install

```bash
cp examples/grill-with-docs-middleware.ts ~/.pi/agent/extensions/
```

No `/reload` needed if you place it in the auto-discovered path — Pi loads it on the next session start. If Pi is already running, use `/reload`.

## Approach B: `input` Event Transform (Fallback)

**File:** [`grill-with-docs-input-transform.ts`](./grill-with-docs-input-transform.ts)

### How it works

1. Hook `input` — fires before skill/template expansion.
2. Regex-match the raw user input for grill-with-docs invocation patterns.
3. If matched, append an instruction to the user prompt text.

### Pros

- Works even if the skill isn't formally loaded (e.g., user pasted skill content manually).

### Cons

- **Fragile** — depends on detecting `/grill-with-docs`, `/skill: grill-with-docs`, or the phrase in free-form text. False positives/negatives are likely.
- Appends text to the **user message**, consuming context window tokens.
- Must be re-evaluated on every input event, not just once per agent turn.

## Approach C: Generic Question Detector (Not Recommended)

An extension could hook `message_end`, parse every assistant message for question patterns, and then:
- Hide the original message
- Inject a user message echoing the question
- Hope the LLM uses `ask_user` on the next turn

This is unreliable, requires an extra round-trip, and often feels janky to the user. It also can't force the use of the rich WebView if the LLM still chooses to respond with text.

## Decision Matrix

| Approach | Detects Skill Reliably | Forces Tool Usage | Extra Round-trip | Token Cost |
|----------|----------------------|-------------------|------------------|------------|
| A (`before_agent_start`) | ✅ High | ✅ System prompt | ❌ No | Low (~100 chars) |
| B (`input` transform) | ⚠️ Regex | ✅ Injected text | ❌ No | Medium (appendix per prompt) |
| C (`message_end` hack) | ❌ Post-hoc | ❌ Hope-based | ✅ Yes | High |

## Recommendation

Use **Approach A** (`before_agent_start` + system prompt injection) as the primary middleware. It is the only approach that reliably detects the skill and mandates tool usage without extra round-trips or fragile regex.

If you find that the skill is sometimes loaded anonymously (bypassing `systemPromptOptions.skills`), combine both A and B for defense in depth.

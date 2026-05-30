# Research: pi-heading Extension Technologies & Patterns

## Summary

The pi-heading extension is built on the Pi coding agent platform using TypeScript and Bun. It uses `ctx.ui.setWorkingMessage()` (not `setWidget`) to display plain text in the UI. The `ui/widget.ts` implementation uses `▸`, `✓`, and `⠋` spinner prefixes via `setHeadingMessage()` — the `setWidget` → `setWorkingMessage` migration initially removed prefixes but they were restored in a later refactor. The project uses a custom prompt evaluation framework (`@alexleekt/pi-shared/prompt-eval`) and employs `response_format: json_object` for structured LLM output. Tests use Bun's native test runner (`bun:test`).

---

## Critical Findings

1. **`setWidget` → `setWorkingMessage` migration restored phase prefixes** — The `ui/widget.ts` implementation now uses `▸` for goal, `✓` for achievement, and `⠋` Braille spinner for working mode. The `setHeadingMessage` function prepends the appropriate prefix before calling `ctx.ui.setWorkingMessage()`. The `startSpinner()` function sets up a `setInterval` loop to animate the Braille frames every 80ms. [Source: ui/widget.ts]

2. **`setWorkingMessage` supports animation via repeated calls** — The Pi coding agent API (`ctx.ui.setWorkingMessage`) is a plain-text setter, but animation is achieved by calling it repeatedly with a `setInterval` loop. The `startSpinner()` function cycles through Braille characters (`⠋`, `⠙`, `⠹`, `⠸`, `⠼`, `⠴`, `⠦`, `⠧`, `⠇`, `⠏`) and updates the working message every 80ms. [Source: ui/widget.ts]

3. **Test runner uses `bun:test` natively** — The project uses Bun's built-in test runner (`import { describe, expect, test } from "bun:test"`). This is the current recommended pattern for Bun + TypeScript. No Jest, Vitest, or other test framework is needed. Tests are colocated with source files (`*.test.ts`). [Source: package.json, llm/summarize.test.ts]

4. **Custom prompt evaluation framework** — The project uses `@alexleekt/pi-shared/prompt-eval` for evaluating LLM prompts. This is a custom framework (not a widely-known open-source tool like `promptfoo` or `langchain`). It supports: test suites with scorers, JSON/raw extraction modes, iterative optimization via a critic LLM, and markdown report generation. [Source: tools/prompt-eval.ts, pi-shared/prompt-eval.ts]

5. **JSON extraction uses `response_format: json_object` with fallback parsing** — The `runPrompt` function in `llm/summarize.ts` sets `response_format: { type: "json_object" }` via an `onPayload` callback. It then implements a three-tier extraction strategy: (a) `JSON.parse` on raw text, (b) `cleanLLMOutput` to strip markdown fences then parse again, (c) regex fallback `extractResultFromJson` for malformed JSON. This is a robust pattern for handling models that may wrap JSON in markdown fences or produce trailing text. [Source: llm/summarize.ts]

---

## Warnings

1. **README/Architecture accuracy** — The README and architecture diagram describe `setHeadingMessage(ctx, goal, "goal")` with `▸` prefix and `setHeadingMessage(ctx, goal, "working")` with `⠋` spinner. The actual code in `ui/widget.ts` correctly implements these prefixes and the spinner animation. The `setWorkingMessage` API is used as the underlying text setter, with prefixes and animation managed by `pi-heading` itself. [Source: README.md, ui/widget.ts]

2. **Braille spinner animation** — The working phase (`agent_start`, `turn_start`) shows an animated Braille spinner via `startSpinner()` which uses `setInterval` to cycle through Braille characters every 80ms. The `setWorkingMessage` API is called repeatedly by the interval callback. This is the approach documented in the ROADMAP as "Plain-text animation via setInterval + setWorkingMessage()". [Source: ui/widget.ts, index.ts]

3. **Bun test runner has limited ecosystem** — While `bun:test` is fast and native, it lacks some features of Vitest/Jest (e.g., snapshot testing, extensive mocking utilities, coverage reporting). The project has no coverage tool configured. [Source: package.json]

4. **`response_format` is injected via `onPayload` callback** — The `onPayload` approach modifies the request payload at the last moment. This is less explicit than passing `response_format` as a direct option to `completeSimple`. If the Pi AI SDK changes its payload structure, this could break silently. [Source: llm/summarize.ts]

5. **Custom prompt eval framework is not battle-tested** — The `@alexleekt/pi-shared/prompt-eval` framework is custom-built. It lacks the robustness of established tools like `promptfoo` (which supports multi-model evaluation, regression testing, CI integration) or `langchain`'s evaluation modules. The proxy URL is hardcoded to `http://localhost:4000/v1/chat/completions`. [Source: pi-shared/prompt-eval.ts]

6. **Thinking mode disabled per model API** — The `thinkingOffOpts` function manually disables thinking for Anthropic and Google models. This is fragile — if new model APIs are added, this switch statement must be updated. There is no centralized configuration for this behavior. [Source: llm/summarize.ts]

---

## Suggestions

1. **Fix the README or restore prefixes** — Either update the README to match the current plain-text behavior, or reimplement the phase prefixes. If `setWidget` is still available in the Pi API, consider migrating back to it for prefix support. If not, prepend prefixes manually in `setHeadingMessage` based on `mode`:
   ```typescript
   const prefix = mode === "working" ? "⠋ " : mode === "achievement" ? "✓ " : "▸ ";
   ctx.ui.setWorkingMessage(prefix + trimmed);
   ```
   Note: This won't animate the Braille spinner, but it will restore the visual phase indicators.

2. **Implement spinner animation with `setInterval`** — If `setWorkingMessage` is the only available API, implement a `setInterval` loop that cycles through Braille characters (`⠋`, `⠙`, `⠹`, `⠸`, `⠼`, `⠴`, `⠦`, `⠧`, `⠇`, `⠏`) and updates the working message periodically. Start the interval in `agent_start`/`turn_start`, clear it in `turn_end`/`agent_end`. This is the approach documented in the ROADMAP as "Plain-text animation via setInterval + setWidget()".

3. **Add `bun:test` coverage** — Bun recently added experimental coverage support (`bun test --coverage`). Add a `test:coverage` script to the package.json. Alternatively, consider Vitest if more advanced testing features are needed (the sibling project `pi-ask-user-glimpse` uses Vitest).

4. **Consider `promptfoo` for prompt evaluation** — `promptfoo` is an open-source prompt evaluation framework with CLI support, multi-model evaluation, regression testing, and CI integration. It could replace or supplement the custom `@alexleekt/pi-shared/prompt-eval` framework. [https://www.promptfoo.dev/]

5. **Use `zod` or `valibot` for JSON schema validation** — Instead of the manual `tryParseJsonResult` → `extractResultFromJson` → `cleanLLMOutput` fallback chain, consider using a schema validator. For example:
   ```typescript
   import { z } from "zod";
   const ResultSchema = z.object({ result: z.string() });
   const parsed = ResultSchema.safeParse(JSON.parse(cleaned));
   ```
   This would provide type-safe parsing and better error messages. However, the current regex fallback is useful for malformed JSON, so keep it as a last resort.

6. **Centralize model configuration** — Move the `thinkingOffOpts` logic and `response_format` injection into a shared model configuration utility in `@alexleekt/pi-shared` so all extensions can benefit from consistent behavior.

7. **Add `tsconfig.json` test inclusion** — The `tsconfig.json` excludes `**/*.test.ts`. This is fine for compilation but may cause IDE issues. Consider adding a separate `tsconfig.test.json` for test files if type-checking tests in isolation is needed.

---

## Research Notes

### Pi Coding Agent Extension API

The Pi coding agent provides an `ExtensionContext` with a `ctx.ui` object. The available methods observed in the codebase:

- `ctx.ui.setWorkingMessage(text: string)` — Sets a plain-text working message in the UI footer. Current code uses this exclusively.
- `ctx.ui.setWorkingVisible(boolean)` — Shows/hides the native "Working" loader.
- `ctx.ui.notify(message, type)` — Shows a notification toast.
- `ctx.ui.input(label)` — Opens a text input dialog.
- `ctx.ui.select(label, choices)` — Opens a selection dialog.
- `ctx.ui.editor()` — Opens an editor (not yet used in pi-heading, but mentioned in ROADMAP).

The older `ctx.ui.setWidget()` API is referenced in the README and ROADMAP but no longer used in the code. The comment in `ui/widget.ts` confirms a migration occurred. The `setWidget` API likely supported custom rendering (prefixes, spinners) but may have been deprecated in favor of `setWorkingMessage` for simplicity or to avoid ghosting issues.

### Bun Test Runner Patterns

The project uses Bun's native test runner (`bun:test`). Patterns observed:

- `import { describe, expect, test, beforeEach, afterEach } from "bun:test"`
- Colocated test files: `module.ts` + `module.test.ts`
- `expect().toBe()` for equality, `expect().toEqual()` for objects
- Temporary directories in `os.tmpdir()` with `beforeEach`/`afterEach` cleanup
- No mocking library used — functions are tested with real file system operations

Bun test runner is fast and has Jest-compatible APIs. The main limitation is ecosystem maturity compared to Vitest/Jest.

### LLM Prompt Evaluation Frameworks

The custom `@alexleekt/pi-shared/prompt-eval` framework provides:

- `runSuite(suite, model)` — Runs test cases against a model
- `generateReport(results, suite, model)` — Generates markdown reports
- `optimizeSuite(factory, promptPath, options)` — Iterative prompt optimization with a critic LLM
- Built-in scorers: `wordCount`, `noMetaCommentary`, `noQuotes`, `noMarkdown`, `validJson`, `presentContinuous`, `noTrailingPeriod`, `alignsWithExpected`

Established alternatives:
- **promptfoo** — Open-source, CLI-driven, supports multi-model evaluation, regression testing, CI integration, red-teaming. [https://www.promptfoo.dev/]
- **LangChain Evals** — Part of LangChain ecosystem, supports criteria-based evaluation, embedding distance, string distance. [https://python.langchain.com/docs/guides/evaluation/]
- **Arize Phoenix** — Observability + evaluation platform for LLM apps. [https://phoenix.arize.com/]
- **EleutherAI LM Eval** — Standardized benchmark framework for model comparison. [https://github.com/EleutherAI/lm-evaluation-harness]

### JSON Extraction from LLM Responses

The project uses `response_format: { type: "json_object" }` which is the OpenAI API standard for forcing JSON output. Best practices observed:

1. **Set `response_format` in the API payload** — Done via `onPayload` callback.
2. **Provide explicit JSON examples in the system prompt** — Done: `Example: {"result": "${example}"}`.
3. **Implement multi-tier extraction** — `JSON.parse` → clean markdown fences → regex fallback. This handles models that ignore `response_format` or wrap output in markdown.
4. **Truncate after extraction** — `truncateToWords` ensures output stays within limits even if the LLM exceeds them.

Known issues with `response_format: json_object`:
- Some models (especially older or non-OpenAI) do not respect this parameter and still wrap JSON in markdown fences.
- The parameter forces valid JSON but does not guarantee the expected schema — a `result` key may be missing or have the wrong type.
- OpenAI's `json_object` mode requires the word "JSON" in the system prompt or user message to activate reliably.

The current code handles these issues well with its fallback chain. Adding a schema validator (zod/valibot) would add an additional safety layer.

---

## Gaps

- We could not confirm whether `ctx.ui.setWidget` is still available in the current Pi coding agent API. The sibling project `pi-ask-user-glimpse` does not use it either, suggesting it may have been deprecated platform-wide.
- We could not determine if `setWorkingMessage` supports any animation or rich formatting options. The API surface is not fully documented in the public codebase.
- No web search was performed to verify current Bun test runner best practices or recent `promptfoo` developments. The recommendations are based on general knowledge as of the knowledge cutoff.

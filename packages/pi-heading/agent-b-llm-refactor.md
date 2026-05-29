# Agent B — LLM Refactor Report

## Task
Split `llm/summarize.ts` (215-line god module) into focused modules, fix security issues, and update imports.

## Files Created

### `util/config.ts`
- Generic config file I/O with `readConfig<T>` and `writeConfig<T>`
- Creates directories with `mode: 0o700` for security

### `llm/prompt.ts`
- `readPromptFile(name, userDir?, defaultDir?)` — prompt file reading with YAML frontmatter parsing
- `buildSystemPrompt(instructions, maxWords, example)` — system prompt construction
- `truncateToWords(text, maxWords)` — text truncation
- **Fix:** `maxWords` guard — `Math.max(1, parseInt(wordsMatch[1], 10))`
- **Fix:** `readPromptFile` — sanitizes `name` with `name.replace(/[\\/]/g, "").replace(/\0/g, "")` before path construction

### `llm/parse.ts`
- `extractTextFromMessage(msg)` — LLM output extraction with defensive string branch
- `cleanLLMOutput(text)` — stripping of markdown, quotes, prefixes
- `tryParseJsonResult(text)` — JSON.parse with `.result` extraction
- `extractResultFromJson(text)` — regex fallback for malformed JSON

### `llm/run.ts`
- `runPrompt(ctx, fileName, message, goal?)` — LLM calling with model resolution
- `thinkingOffOpts(model)` — provider-specific thinking disable options
- **Fix:** Template substitution uses replacement functions to avoid `$` interpolation:
  ```ts
  let userText = promptFile.template.replace(/\{message\}/g, () => message);
  ```
- **Fix:** `onPayload` callback returns a new object instead of mutating:
  ```ts
  return { ...(payload as Record<string, unknown>), response_format: { type: "json_object" } };
  ```
- **Fix:** `maxTokens` heuristic extracted to named function:
  ```ts
  function maxTokensForSummary(maxWords: number): number { return Math.min(128, maxWords * 2 + 8); }
  ```

## Files Modified

### `llm/summarize.ts`
- Reduced from ~215 lines to ~45 lines
- Thin orchestration layer: `summarize()` and `summarizeAchievement()`
- Re-exports `extractTextFromMessage` for backwards compatibility
- Re-exports `RunPromptResult` and `SummarizeResult` types

### `llm/picker.ts`
- Removed `getDebugMode`/`setDebugMode` (moved to `state/debug.ts`)
- Now uses `util/config.ts` for config I/O
- `getModelOverride` validates `typeof cfg.modelOverride === "string"`
- Only handles model picking: `getModelOverride`, `setModelOverride`, `resolveModelId`

### `state/debug.ts`
- Added `getDebugMode`/`setDebugMode` (moved from `llm/picker.ts`)
- Added `setDebugLogPath`/`getDebugLogPath` for testability
- Moved debug log from `/tmp/pi-heading-debug.log` to `~/.pi/agent/extensions/pi-heading/debug.log`
- Ensures `DEBUG_DIR` exists with `mode: 0o700`
- Writes log with `mode: 0o600`
- Uses `util/config.ts` for config access
- Added `readDebugLog` parameter validation

### `handlers/commands.ts`
- Updated imports: `getDebugMode`/`setDebugMode` now from `../state/debug.js`

### `index.test.ts`
- Updated imports: `setDebugMode` now from `./state/debug.js`
- Added `clearState()` call in `beforeEach` to prevent cross-test state pollution
- Added default config cleanup in `afterEach`
- Updated test expectations to match new widget behavior (prefixes, spinner)
- Updated tests for removed `sendMessage` calls in `turn_end`

### `llm/summarize.test.ts`
- Updated imports: `readPromptFile`, `truncateToWords` from `./prompt.js`, `cleanLLMOutput` from `./parse.js`
- Added tests for `extractTextFromMessage` and `thinkingOffOpts`
- Added test for `readPromptFile` fallback (no `Message:` marker)

### `llm/summarize-pipeline.test.ts`
- Added default config cleanup in `beforeAll` to prevent model override pollution

### `ui/widget.test.ts`
- Updated to match new prefix behavior (`▸`, `✓`, `⠋`)
- Added tests for `startSpinner` and `stopSpinner`

### `state/store.ts`
- Added `clearState()` for test isolation
- Fixed type casts in `replayBranch` using `as unknown` intermediate

## Test Results
- **148 tests pass, 0 fail** (up from 114)
- New test coverage: `llm/prompt.ts`, `llm/parse.ts`, `state/debug.ts`, `ui/widget.ts`
- Typecheck: `tsc --noEmit` passes

## Security Fixes
1. **Path traversal in `readPromptFile`**: `name` is sanitized before path construction
2. **Template substitution `$` corruption**: Uses replacement functions to avoid `$` interpolation
3. **Debug log privacy**: Moved from world-readable `/tmp` to private `~/.pi/agent/extensions/pi-heading/` with `0o700` dir and `0o600` file perms
4. **Config directory perms**: `util/config.ts` creates dirs with `mode: 0o700`
5. **Type safety**: `getModelOverride` validates `typeof cfg.modelOverride === "string"`

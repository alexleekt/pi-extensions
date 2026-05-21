---
parent: ../../AGENT.md
---

# AGENT.md — @alexleekt/pi-shared

## Monorepo Context

This package lives inside the `pi-extensions` monorepo. See [`../../AGENT.md`](../../AGENT.md) for monorepo-wide conventions (shared tooling, just commands, release process, CI setup).

## Purpose

Shared types and utilities for Pi extensions in this monorepo.

## Exports

| Path | Description |
|------|-------------|
| `@alexleekt/pi-shared/session` | `manageSessionSubscription()` — per-session subscription lifecycle helper |
| `@alexleekt/pi-shared/types` | Shared Pi extension type definitions |
| `@alexleekt/pi-shared/prompt-eval` | Generalized prompt evaluation framework |

## `@alexleekt/pi-shared/prompt-eval`

A reusable framework for evaluating LLM prompts against test cases. Extracted from `pi-heading`'s duplicated `prompt-eval-*.ts` scripts.

### Core types

```typescript
export interface EvalSuite<T extends TestCase = TestCase> {
  name: string;
  testCases: T[];
  promptBuilder: (testCase: T) => PromptMessage;   // { system, user, maxTokens }
  extractMode: "json" | "raw";
  scorers: Scorer<T>[];
  modelConfig?: ModelConfig;
}

export type Scorer<T extends TestCase = TestCase> = (params: {
  text: string;      // extracted result
  raw: string;       // raw LLM output
  testCase: T;
}) => ScoreResult;
```

### Key functions

| Function | Purpose |
|----------|---------|
| `runSuite(suite, model)` | Evaluate all test cases, score outputs, print progress |
| `generateReport(results, suite, model)` | Build markdown report string |
| `callLLM(system, user, model, config?)` | Call local proxy with retry |
| `extractResult(raw)` | Parse `{"result": "..."}` or fall back to raw |
| `optimizeSuite(factory, promptPath, config)` | Iterative prompt optimization loop |

### Built-in scorers

```typescript
scorers.wordCount(max)
scorers.withinLimit(max)
scorers.noMetaCommentary()
scorers.noQuotes()
scorers.noMarkdown()
scorers.validJson()
scorers.presentContinuous()
scorers.pastTense()
scorers.noTrailingPeriod()
scorers.concise(threshold)
scorers.alignsWithExpected(field, threshold)
scorers.echoesGoal(goalField, threshold)
scorers.specificConcrete()
scorers.noVagueFiller()
```

### Iterative optimization

```typescript
import { optimizeSuite } from "@alexleekt/pi-shared/prompt-eval";

const result = await optimizeSuite(
  (promptText) => mySuiteFactory(promptText),   // factory builds EvalSuite from prompt text
  "/path/to/prompt.md",                         // file to mutate in-place
  {
    desirableOutcome: "Concise past-tense summaries under 12 words, no meta-commentary",
    targetPassRate: 85,
    maxIterations: 5,
    evalModel: "firepass",
    criticModel: "firepass",
  }
);
```

The optimization loop:
1. Load prompt from file
2. Run suite → check pass rate
3. If below target, collect top N failing cases
4. Call critic LLM with failures + desirable outcome description
5. Write revised prompt back to file
6. Repeat until target met or max iterations

### Conventions

- **TypeScript only** — no runtime build step, Pi loads `.ts` directly
- `tsconfig.json` extends `../tsconfig.base.json`
- `typecheck` script runs `tsc --noEmit`
- No tests in this package (tested indirectly via dependent extensions)
- Keep surface area small — this is a shared library, not a feature dump
- All `TestCase` subtypes must declare `[key: string]: unknown` to satisfy the generic constraint
- New scorers are pure functions returning `ScoreResult` — no side effects

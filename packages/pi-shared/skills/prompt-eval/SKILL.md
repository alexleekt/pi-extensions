---
name: prompt-eval
description: Evaluate and optimize LLM prompts using the @alexleekt/pi-shared/prompt-eval framework. Use when you need to measure prompt quality against test cases, score outputs with built-in criteria, or iteratively rewrite prompts to hit a target pass rate. Works with any Pi extension that has prompt files and JSON test cases.
license: MIT
compatibility: Requires Bun or Node >= 18. Uses a local LLM proxy at http://localhost:4000 by default. Evaluated extensions must use @alexleekt/pi-shared as a workspace dependency.
---

# prompt-eval

Evaluate and optimize LLM prompts with data-driven scoring.

## When to use

- You just edited a prompt file and want to know if quality improved or regressed
- You're shipping a new extension and need confidence its prompts produce consistent output
- A prompt is flaky (sometimes returns markdown, sometimes meta-commentary) and you want to lock it down
- You want to automatically rewrite a prompt until it hits a target quality threshold

## What it does

1. **Evaluate** — Run a prompt against a JSON test case set. Score every output against configurable criteria (word count, no markdown, valid JSON, semantic alignment, tense, etc.). Produces a markdown report.
2. **Optimize** — Iteratively critique failing cases, rewrite the prompt via LLM, re-evaluate. Repeats until a target pass rate is hit or max iterations reached. Mutates the prompt file in-place.

## Quick start (inside a package)

This skill assumes you're working in a Pi extension package that already has:
- A `prompts/` directory with `.md` prompt files
- A `tools/` directory with `test-cases.json` test cases

### 1. Add pi-shared dependency

```json
// package.json
{
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*"
  },
  "dependencies": {
    "@alexleekt/pi-shared": "workspace:*"
  }
}
```

### 2. Write a suite

Create `tools/suites/my-prompt.suite.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import { runSuite, generateReport, scorers, type EvalSuite } from "@alexleekt/pi-shared/prompt-eval";

const __dirname = import.meta.dirname;

interface MyTestCase {
  [key: string]: unknown;
  input: string;
  maxWords: number;
  expected?: string;
}

function loadTestCases(file: string): MyTestCase[] {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", file), "utf8"));
}

function buildPrompt(instructions: string, maxWords: number, message: string) {
  const system = `${instructions}\n\nOutput ${maxWords} words max. Return JSON: {"result": "..."}`;
  return { system, user: message, maxTokens: 128 };
}

export function createSuite(testCasesFile = "test-cases.json"): EvalSuite<MyTestCase> {
  const testCases = loadTestCases(testCasesFile);
  const instructions = fs.readFileSync(
    path.join(__dirname, "..", "..", "prompts", "my-prompt.md"),
    "utf8"
  ).replace(/^---\s*\n[\s\S]*?---\s*(?:\n|$)/, "");

  return {
    name: "my-prompt",
    testCases,
    promptBuilder: (tc) => buildPrompt(instructions, tc.maxWords, tc.input),
    extractMode: "json",
    scorers: [
      scorers.wordCount(tc.maxWords),
      scorers.noMetaCommentary(),
      scorers.validJson(),
      ...(testCases.some((tc) => tc.expected)
        ? [scorers.alignsWithExpected("expected", 0.5)]
        : []),
    ],
  };
}

export async function run(model: string, testCasesFile?: string) {
  const suite = createSuite(testCasesFile);
  const results = await runSuite(suite, model);
  const report = generateReport(results, suite, model);
  fs.writeFileSync(path.join(__dirname, "..", "report.md"), report, "utf8");
  console.log(`Report: ${path.join(__dirname, "..", "report.md")}`);
}
```

### 3. Write test cases

```json
// tools/test-cases.json
[
  { "input": "How do I fix the memory leak?", "maxWords": 12, "expected": "Fixing the memory leak" },
  { "input": "hi there", "maxWords": 12, "expected": "Establishing the session goal" }
]
```

### 4. Run evaluation

```bash
cd ~/git/pi-extensions/packages/my-package
bun -e 'import { run } from "./tools/suites/my-prompt.suite.ts"; await run("firepass");'
```

## Optimization loop

### Add a suite factory

The factory is what `optimizeSuite` uses to rebuild the suite with a revised prompt:

```typescript
// Add to tools/suites/my-prompt.suite.ts
export function suiteFactory(testCasesFile = "test-cases.json") {
  const testCases = loadTestCases(testCasesFile);
  return (promptText: string) => ({
    name: "my-prompt",
    testCases,
    promptBuilder: (tc) => buildPrompt(promptText, tc.maxWords, tc.input),
    extractMode: "json",
    scorers: [scorers.wordCount(12), scorers.noMetaCommentary(), scorers.validJson()],
  });
}
```

### Run optimization

```bash
bun -e '
import { optimizeSuite } from "@alexleekt/pi-shared/prompt-eval";
import { suiteFactory } from "./tools/suites/my-prompt.suite.ts";

const result = await optimizeSuite(
  suiteFactory("test-cases.json"),
  "prompts/my-prompt.md",
  {
    desirableOutcome: "Concise present-continuous summaries under 12 words, no meta-commentary, valid JSON",
    targetPassRate: 90,
    maxIterations: 5,
    evalModel: "firepass",
    criticModel: "firepass",
  }
);

console.log("Success:", result.success);
console.log("Best pass rate:", result.bestIteration.passRate, "% at iteration", result.bestIteration.iteration);
'
```

## Built-in scorers reference

| Scorer | What it checks |
|--------|---------------|
| `wordCount(max)` | Word count > 0 and ≤ max |
| `withinLimit(max)` | Alias for wordCount |
| `noMetaCommentary()` | Does not start with "The user…", "User wants…" |
| `noQuotes()` | Does not start/end with quotes |
| `noMarkdown()` | Does not contain ``` |
| `validJson()` | Raw response is valid JSON with `"result"` string field |
| `presentContinuous()` | Starts with an -ing verb (or known exception) |
| `pastTense()` | Starts with a past-tense verb |
| `noTrailingPeriod()` | Does not end with `.` |
| `concise(threshold)` | Word count ≤ threshold |
| `alignsWithExpected(field, threshold)` | Normalized word overlap with `testCase[field]` |
| `echoesGoal(goalField, threshold)` | Word overlap between output and goal field |
| `specificConcrete()` | Contains file paths, commands, or counts |
| `noVagueFiller()` | Fewer than 3 vague filler words |

Custom scorers are pure functions:

```typescript
const myScorer: Scorer = ({ text, raw, testCase }) => ({
  name: "custom",
  passed: text.includes("expected-token"),
  detail: `length=${text.length}`,
});
```

## Architecture

```
pi-shared/prompt-eval.ts
├── Types: EvalSuite, Scorer, ScoreResult, PromptMessage, OptimizeConfig
├── Functions: runSuite, generateReport, callLLM, extractResult, optimizeSuite
└── scorers: 14 built-in scorers

Extension tools/
├── suites/<name>.suite.ts   → createSuite(), suiteFactory(), run()
├── test-cases.json          → [{ input, expected, maxWords, ... }]
├── prompt-eval.ts (optional) → CLI wrapper
└── prompts/*.md             → Prompt files with YAML frontmatter
```

## Invariants

1. **TestCase must have index signature**: All case interfaces need `[key: string]: unknown` to satisfy the generic `TestCase` constraint.
2. **Frontmatter is stripped for LLM, preserved for optimizer**: `loadPrompt()` strips `---\n---` blocks before sending to the LLM. The optimizer's `createCriticPrompt()` instructs the critic to preserve frontmatter.
3. **Suite factory takes raw text**: `suiteFactory` must return `(promptText: string) => EvalSuite` so `optimizeSuite` can inject revised prompts without file I/O.
4. **Prompt paths are relative to package root**: The CLI resolves paths against the package directory, not `tools/`.

## Examples in this monorepo

| Package | Suite | Test cases | Prompts |
|---------|-------|-----------|---------|
| `pi-heading` | `tools/suites/topic.suite.ts` | `tools/test-cases.json` (8 cases) | `prompts/topic.md` |
| `pi-heading` | `tools/suites/goal.suite.ts` | `tools/test-cases-comprehensive.json` (50+) | `prompts/goal.md` |

See `packages/pi-heading/tools/prompt-eval.ts` for a full CLI that wraps both evaluation and optimization.

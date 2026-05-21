// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
//
// Goal extraction evaluation suite for pi-heading.
//
// Usage:
//   bun tools/prompt-eval.ts goal [model-id] [test-cases.json]

import * as fs from "node:fs";
import * as path from "node:path";
import {
  runSuite,
  generateReport,
  scorers,
  type EvalSuite,
} from "@alexleekt/pi-shared/prompt-eval";

const __dirname = import.meta.dirname;

interface GoalTestCase {
  [key: string]: unknown;
  input: string;
  maxGoalWords: number;
  expectedGoal?: string;
}

function loadTestCases(fileName: string): GoalTestCase[] {
  const p = path.join(__dirname, "..", fileName);
  return JSON.parse(fs.readFileSync(p, "utf8")) as GoalTestCase[];
}

export function loadPrompt(fileName: string, customPath?: string): string {
  const p = customPath ?? path.join(__dirname, "..", "..", "prompts", fileName);
  return fs.readFileSync(p, "utf8").replace(/^---\s*\n[\s\S]*?---\s*(?:\n|$)/, "");
}

function buildPrompt(instructions: string, maxWords: number, message: string) {
  const system = `${instructions}\n\nSTRICT FORMAT RULES:\n- You MUST respond with a valid JSON object containing a single key "result".\n- The value of "result" must be ${maxWords} words or fewer.\n- NO quotes, NO markdown, NO explanation, NO word count, NO meta-commentary inside the JSON.\n- Example: {"result": "Fix the memory leak in the Rust service"}`;
  return { system, user: `Message: ${message}`, maxTokens: Math.min(128, maxWords * 2 + 8) };
}

function makeSuite(testCases: GoalTestCase[], instructions: string): EvalSuite<GoalTestCase> {
  const suiteScorers = [
    scorers.wordCount(12), // goals are always ≤12 words
    scorers.noMetaCommentary(),
    scorers.noQuotes(),
    scorers.noMarkdown(),
    scorers.validJson(),
    scorers.presentContinuous(),
    scorers.noTrailingPeriod(),
  ];

  if (testCases.some((tc) => tc.expectedGoal)) {
    suiteScorers.push(scorers.alignsWithExpected("expectedGoal", 0.5));
  }

  return {
    name: "goal",
    testCases,
    promptBuilder: (tc) => buildPrompt(instructions, tc.maxGoalWords, tc.input),
    extractMode: "json",
    scorers: suiteScorers,
  };
}

export function createSuite(testCasesFile = "test-cases.json", promptPath?: string): EvalSuite<GoalTestCase> {
  const testCases = loadTestCases(testCasesFile);
  const instructions = loadPrompt("goal.md", promptPath);
  return makeSuite(testCases, instructions);
}

/** Factory for optimizeSuite — builds a suite from raw prompt text. */
export function suiteFactory(testCasesFile = "test-cases.json"): (promptText: string) => EvalSuite<GoalTestCase> {
  const testCases = loadTestCases(testCasesFile);
  return (promptText) => makeSuite(testCases, promptText);
}

export async function run(model: string, testCasesFile?: string) {
  const suite = createSuite(testCasesFile);
  const results = await runSuite(suite, model);
  const report = generateReport(results, suite, model);
  const outPath = path.join(__dirname, "..", `prompt-eval-report-goal.md`);
  fs.writeFileSync(outPath, report, "utf8");
  console.log(`\n✅ Report written to: ${outPath}`);
  return results;
}

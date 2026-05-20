// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
/**
 * Comprehensive prompt evaluation for pi-heading.
 *
 * Tests 50+ messages across categories. Target: 98% pass rate.
 *
 * Usage:
 *   bun tools/prompt-eval-comprehensive.ts [model-id]
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface TestCase {
  category: string;
  input: string;
  maxTopicWords: number;
  maxGoalWords: number;
  expectedTopic?: string;
  expectedGoal?: string;
}

interface EvalResult {
  case: TestCase;
  topicRaw: string;
  goalRaw: string;
  topicPass: boolean;
  goalPass: boolean;
  topicWordCount: number;
  goalWordCount: number;
  topicMeta: boolean;
  goalMeta: boolean;
  latencyMs: number;
}

const PROXY_URL = "http://localhost:4000/v1/chat/completions";
const DEFAULT_MODEL = "firepass";

async function callLLM(systemPrompt: string, userMessage: string, model: string, maxTokens: number, retries = 3): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: maxTokens,
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    if (res.ok) {
      const json = await res.json() as any;
      return json.choices?.[0]?.message?.content ?? "";
    }

    if (res.status === 429 && attempt < retries) {
      const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
      console.log(`  Rate limited. Retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    const body = await res.text();
    throw new Error(`LLM error ${res.status}: ${body}`);
  }
  throw new Error("Max retries exceeded");
}

function extractResult(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.result === "string") {
      return parsed.result;
    }
  } catch {
    // fall through
  }
  return raw;
}

function isMeta(text: string): boolean {
  return /^\s*(The user|User wants|asking a|giving feedback|I need to|I should)/i.test(text);
}

function scoreTopic(raw: string, maxWords: number): { pass: boolean; wordCount: number; meta: boolean } {
  const text = extractResult(raw);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const pass = wordCount > 0 && wordCount <= maxWords && !isMeta(text);
  return { pass, wordCount, meta: isMeta(text) };
}

function scoreGoal(raw: string, maxWords: number, expectedGoal?: string, userInput?: string): { pass: boolean; wordCount: number; meta: boolean } {
  const text = extractResult(raw);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const noMeta = !isMeta(text);
  const withinLimit = wordCount > 0 && wordCount <= maxWords;

  // Semantic check: if expectedGoal is provided, do a rough similarity.
  // Also accept the user's raw message as a valid fallback (echo behavior).
  let semanticMatch = true;
  if (expectedGoal && noMeta && withinLimit) {
    const normExpected = expectedGoal.toLowerCase().replace(/[^a-z0-9]/g, " ");
    const normActual = text.toLowerCase().replace(/[^a-z0-9]/g, " ");
    const expectedWords = new Set(normExpected.split(/\s+/).filter((w) => w.length > 3));
    const actualWords = new Set(normActual.split(/\s+/).filter((w) => w.length > 3));
    let common = 0;
    for (const w of expectedWords) {
      if (actualWords.has(w)) common++;
    }

    // Check if the output is the user's message echoed back (valid fallback)
    const isEchoFallback = userInput ? text.trim().toLowerCase() === userInput.trim().toLowerCase() : false;

    semanticMatch = common >= 1 || expectedWords.size === 0 || isEchoFallback;
  }

  const pass = withinLimit && noMeta && semanticMatch;
  return { pass, wordCount, meta: !noMeta };
}

async function evaluate(model: string): Promise<EvalResult[]> {
  const cases: TestCase[] = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "test-cases-comprehensive.json"), "utf8"),
  );

  const topicInstructions = fs.readFileSync(
    path.join(import.meta.dirname, "..", "prompts", "topic.md"), "utf8",
  ).replace(/^---\s*\n[\s\S]*?---\s*(?:\n|$)/, "");

  const goalInstructions = fs.readFileSync(
    path.join(import.meta.dirname, "..", "prompts", "goal.md"), "utf8",
  ).replace(/^---\s*\n[\s\S]*?---\s*(?:\n|$)/, "");

  const results: EvalResult[] = [];

  for (const tc of cases) {
    const start = Date.now();

    const topicSystem = `${topicInstructions}\n\nSTRICT FORMAT RULES:\n- You MUST respond with a valid JSON object: {"result": "<label>"}\n- The label must be ${tc.maxTopicWords} words or fewer.\n- Example: {"result": "Rust memory leak"}`;
    const topicRaw = await callLLM(topicSystem, tc.input, model, Math.min(128, tc.maxTopicWords * 2 + 8));
    const topicScore = scoreTopic(topicRaw, tc.maxTopicWords);

    const goalSystem = `${goalInstructions}\n\nSTRICT FORMAT RULES:\n- You MUST respond with a valid JSON object: {"result": "<sentence>"}\n- The sentence must be ${tc.maxGoalWords} words or fewer.\n- Example: {"result": "Fix the memory leak in the Rust service."}`;
    const goalRaw = await callLLM(goalSystem, tc.input, model, Math.min(128, tc.maxGoalWords * 2 + 8));
    const goalScore = scoreGoal(goalRaw, tc.maxGoalWords, tc.expectedGoal, tc.input);

    const latencyMs = Date.now() - start;

    results.push({
      case: tc,
      topicRaw,
      goalRaw,
      topicPass: topicScore.pass,
      goalPass: goalScore.pass,
      topicWordCount: topicScore.wordCount,
      goalWordCount: goalScore.wordCount,
      topicMeta: topicScore.meta,
      goalMeta: goalScore.meta,
      latencyMs,
    });
  }

  return results;
}

function report(results: EvalResult[], model: string): string {
  const lines: string[] = [];
  lines.push(`# Comprehensive Prompt Evaluation Report`);
  lines.push("");
  lines.push(`- **Model**: ${model}`);
  lines.push(`- **Date**: ${new Date().toISOString()}`);
  lines.push(`- **Test cases**: ${results.length}`);
  lines.push("");

  const topicPasses = results.filter((r) => r.topicPass).length;
  const goalPasses = results.filter((r) => r.goalPass).length;
  const topicRate = (topicPasses / results.length * 100).toFixed(1);
  const goalRate = (goalPasses / results.length * 100).toFixed(1);

  lines.push(`## Overall Results`);
  lines.push("");
  lines.push(`| Metric | Topic | Goal |`);
  lines.push(`|--------|-------|------|`);
  lines.push(`| Pass rate | ${topicRate}% (${topicPasses}/${results.length}) | ${goalRate}% (${goalPasses}/${results.length}) |`);
  lines.push(`| Target (≥98%) | ${parseFloat(topicRate) >= 98 ? "✅" : "❌"} | ${parseFloat(goalRate) >= 98 ? "✅" : "❌"} |`);
  lines.push("");

  // Category breakdown
  const categories = [...new Set(results.map((r) => r.case.category))];
  lines.push(`## By Category`);
  lines.push("");
  lines.push(`| Category | Cases | Topic Pass | Goal Pass |`);
  lines.push(`|----------|-------|------------|-----------|`);
  for (const cat of categories) {
    const catResults = results.filter((r) => r.case.category === cat);
    const catTopicPasses = catResults.filter((r) => r.topicPass).length;
    const catGoalPasses = catResults.filter((r) => r.goalPass).length;
    lines.push(`| ${cat} | ${catResults.length} | ${catTopicPasses}/${catResults.length} | ${catGoalPasses}/${catResults.length} |`);
  }
  lines.push("");

  // Failing cases
  const topicFails = results.filter((r) => !r.topicPass);
  const goalFails = results.filter((r) => !r.goalPass);

  if (topicFails.length > 0) {
    lines.push(`## Failing Topics (${topicFails.length})`);
    lines.push("");
    for (const r of topicFails) {
      lines.push(`### ${r.case.category}: "${r.case.input.slice(0, 60)}${r.case.input.length > 60 ? "…" : ""}"`);
      lines.push(`\`\`\`text`);
      lines.push(r.topicRaw);
      lines.push(`\`\`\``);
      lines.push(`- Words: ${r.topicWordCount} (max ${r.case.maxTopicWords})`);
      lines.push(`- Meta-commentary: ${r.topicMeta ? "❌ YES" : "✅ no"}`);
      lines.push("");
    }
  }

  if (goalFails.length > 0) {
    lines.push(`## Failing Goals (${goalFails.length})`);
    lines.push("");
    for (const r of goalFails) {
      lines.push(`### ${r.case.category}: "${r.case.input.slice(0, 60)}${r.case.input.length > 60 ? "…" : ""}"`);
      lines.push(`Expected: "${r.case.expectedGoal ?? "(any concrete goal)"}"`);
      lines.push(`\`\`\`text`);
      lines.push(r.goalRaw);
      lines.push(`\`\`\``);
      lines.push(`- Words: ${r.goalWordCount} (max ${r.case.maxGoalWords})`);
      lines.push(`- Meta-commentary: ${r.goalMeta ? "❌ YES" : "✅ no"}`);
      lines.push("");
    }
  }

  lines.push(`---`);
  lines.push(`*End of report*`);
  return lines.join("\n");
}

async function main() {
  const model = process.argv[2] || DEFAULT_MODEL;
  console.log(`🔬 Comprehensive evaluation against model: ${model}`);

  const results = await evaluate(model);

  const topicPasses = results.filter((r) => r.topicPass).length;
  const goalPasses = results.filter((r) => r.goalPass).length;
  const topicRate = (topicPasses / results.length * 100).toFixed(1);
  const goalRate = (goalPasses / results.length * 100).toFixed(1);

  console.log(`\n📊 Results:`);
  console.log(`  Topic: ${topicRate}% (${topicPasses}/${results.length})`);
  console.log(`  Goal:  ${goalRate}% (${goalPasses}/${results.length})`);
  console.log(`  Target: ≥98%`);

  const markdown = report(results, model);
  const outPath = path.join(import.meta.dirname, "prompt-eval-comprehensive-report.md");
  fs.writeFileSync(outPath, markdown, "utf8");
  console.log(`\n✅ Report: ${outPath}`);
}

main().catch((err) => {
  console.error("💥 Evaluation failed:", err);
  process.exit(1);
});

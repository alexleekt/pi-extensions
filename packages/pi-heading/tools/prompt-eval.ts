// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
/**
 * Prompt evaluation harness for pi-heading.
 *
 * Calls the real LLM through the local proxy, evaluates responses against
 * scoring criteria, and writes a markdown report.
 *
 * Usage:
 *   bun tools/prompt-eval.ts [model-id]
 *
 * The default model is "firepass" (Kimi K2.6 Turbo through Glasspath).
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface TestCase {
  input: string;
  expectedTopic?: string;
  expectedGoal?: string;
  maxTopicWords: number;
  maxGoalWords: number;
}

interface EvalResult {
  input: string;
  topicRaw: string;
  goalRaw: string;
  topicScore: Score;
  goalScore: Score;
  latencyMs: number;
}

interface Score {
  wordCount: number;
  withinLimit: boolean;
  noMetaCommentary: boolean;
  noQuotes: boolean;
  noMarkdown: boolean;
  total: number; // 0-5
}

const PROXY_URL = "http://localhost:4000/v1/chat/completions";
const DEFAULT_MODEL = "firepass";
const TEST_CASES: TestCase[] = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, process.argv[4] || "test-cases.json"), "utf8"),
);

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

function isValidJson(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed.result === "string";
  } catch {
    return false;
  }
}

function score(text: string, maxWords: number): Score {
  const extracted = extractResult(text);
  const words = extracted.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const withinLimit = wordCount <= maxWords && wordCount > 0;
  const noMetaCommentary = !/^\s*(The user|User wants|asking a|giving feedback)/i.test(extracted);
  const noQuotes = !/^["'`].*["'`]$/s.test(extracted.trim());
  const noMarkdown = !/```/.test(extracted);
  const validJson = isValidJson(text);
  const total = [withinLimit, noMetaCommentary, noQuotes, noMarkdown, validJson].filter(Boolean).length;
  return { wordCount, withinLimit, noMetaCommentary, noQuotes, noMarkdown, total };
}

async function callLLM(
  systemPrompt: string,
  userMessage: string,
  model: string,
  maxTokens: number,
  useJsonMode: boolean = true,
): Promise<string> {
  const payload: any = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature: 0,
  };
  if (useJsonMode) {
    payload.response_format = { type: "json_object" };
  }

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM error ${res.status}: ${body}`);
  }

  const json = await res.json() as any;
  return json.choices?.[0]?.message?.content ?? "";
}

function buildTopicPrompt(instructions: string, maxWords: number, message: string): string {
  return `${instructions}\n\nSTRICT FORMAT RULES:\n- You MUST respond with a valid JSON object containing a single key "result".\n- The value of "result" must be ${maxWords} words or fewer.\n- NO quotes, NO markdown, NO explanation, NO word count, NO meta-commentary inside the JSON.\n- Example: {"result": "Rust memory leak"}\n\nMessage: ${message}`;
}

function buildGoalPrompt(instructions: string, maxWords: number, message: string): string {
  return `${instructions}\n\nSTRICT FORMAT RULES:\n- You MUST respond with a valid JSON object containing a single key "result".\n- The value of "result" must be ${maxWords} words or fewer.\n- NO quotes, NO markdown, NO explanation, NO word count, NO meta-commentary inside the JSON.\n- Example: {"result": "Fix the memory leak in the Rust service."}\n\nMessage: ${message}`;
}

/** Alternative: put the entire task in the user message. */
function buildTopicPromptUserMessage(instructions: string, maxWords: number, message: string): { system: string; user: string } {
  return {
    system: "You are a concise assistant. Follow the user's instructions exactly.",
    user: `${instructions}\n\nSTRICT FORMAT RULES:\n- You MUST respond with a valid JSON object containing a single key "result".\n- The value of "result" must be ${maxWords} words or fewer.\n- NO quotes, NO markdown, NO explanation, NO word count, NO meta-commentary inside the JSON.\n- Example: {"result": "Rust memory leak"}\n\nMessage: ${message}`,
  };
}

function buildGoalPromptUserMessage(instructions: string, maxWords: number, message: string): { system: string; user: string } {
  return {
    system: "You are a concise assistant. Follow the user's instructions exactly.",
    user: `${instructions}\n\nSTRICT FORMAT RULES:\n- You MUST respond with a valid JSON object containing a single key "result".\n- The value of "result" must be ${maxWords} words or fewer.\n- NO quotes, NO markdown, NO explanation, NO word count, NO meta-commentary inside the JSON.\n- Example: {"result": "Fix the memory leak in the Rust service."}\n\nMessage: ${message}`,
  };
}

async function evaluate(model: string, useUserMessage: boolean = false, useMinimal: boolean = false): Promise<EvalResult[]> {
  let topicInstructions: string;
  let goalInstructions: string;

  if (useMinimal) {
    topicInstructions = fs.readFileSync(
      path.join(import.meta.dirname, "prompt-minimal.md"),
      "utf8",
    ).replace(/^---\s*\n[\s\S]*?---\s*(?:\n|$)/, "");
    goalInstructions = fs.readFileSync(
      path.join(import.meta.dirname, "prompt-minimal-goal.md"),
      "utf8",
    ).replace(/^---\s*\n[\s\S]*?---\s*(?:\n|$)/, "");
  } else {
    topicInstructions = fs.readFileSync(
      path.join(import.meta.dirname, "..", "prompts", "topic.md"),
      "utf8",
    ).replace(/^---\s*\n[\s\S]*?---\s*(?:\n|$)/, "");
    goalInstructions = fs.readFileSync(
      path.join(import.meta.dirname, "..", "prompts", "goal.md"),
      "utf8",
    ).replace(/^---\s*\n[\s\S]*?---\s*(?:\n|$)/, "");
  }

  const results: EvalResult[] = [];

  for (const tc of TEST_CASES) {
    let topicRaw: string;
    let goalRaw: string;
    const topicStart = Date.now();

    if (useUserMessage) {
      const topicPrompt = buildTopicPromptUserMessage(topicInstructions, tc.maxTopicWords, tc.input);
      topicRaw = await callLLM(topicPrompt.system, topicPrompt.user, model, Math.min(128, tc.maxTopicWords * 2 + 8));
      const goalPrompt = buildGoalPromptUserMessage(goalInstructions, tc.maxGoalWords, tc.input);
      goalRaw = await callLLM(goalPrompt.system, goalPrompt.user, model, Math.min(128, tc.maxGoalWords * 2 + 8));
    } else {
      topicRaw = await callLLM(
        buildTopicPrompt(topicInstructions, tc.maxTopicWords, tc.input),
        tc.input,
        model,
        Math.min(128, tc.maxTopicWords * 2 + 8),
      );
      const goalStart = Date.now();
      goalRaw = await callLLM(
        buildGoalPrompt(goalInstructions, tc.maxGoalWords, tc.input),
        tc.input,
        model,
        Math.min(128, tc.maxGoalWords * 2 + 8),
      );
    }

    const latencyMs = Date.now() - topicStart;

    results.push({
      input: tc.input,
      topicRaw,
      goalRaw,
      topicScore: score(topicRaw, tc.maxTopicWords),
      goalScore: score(goalRaw, tc.maxGoalWords),
      latencyMs,
    });
  }

  return results;
}

function report(results: EvalResult[], model: string, mode: string): string {
  const lines: string[] = [];
  lines.push(`# Prompt Evaluation Report`);
  lines.push("");
  lines.push(`- **Model**: ${model}`);
  lines.push(`- **Mode**: ${mode === "user" ? "Instructions in USER message" : "Instructions in SYSTEM prompt"}`);
  lines.push(`- **Date**: ${new Date().toISOString()}`);
  lines.push(`- **Test cases**: ${results.length}`);
  lines.push("");

  const topicScores = results.map((r) => r.topicScore.total);
  const goalScores = results.map((r) => r.goalScore.total);
  const avgTopic = topicScores.reduce((a, b) => a + b, 0) / topicScores.length;
  const avgGoal = goalScores.reduce((a, b) => a + b, 0) / goalScores.length;

  lines.push(`## Summary`);
  lines.push("");
  lines.push(`| Metric | Topic | Goal |`);
  lines.push(`|--------|-------|------|`);
  lines.push(`| Average score (0-5) | ${avgTopic.toFixed(2)} | ${avgGoal.toFixed(2)} |`);
  lines.push(`| Perfect 5/5 | ${topicScores.filter((s) => s === 5).length} | ${goalScores.filter((s) => s === 5).length} |`);
  lines.push(`| Failed (≤2) | ${topicScores.filter((s) => s <= 2).length} | ${goalScores.filter((s) => s <= 2).length} |`);
  lines.push("");

  lines.push(`## Per-Case Results`);
  lines.push("");

  for (const r of results) {
    lines.push(`### Input: "${r.input.slice(0, 60)}${r.input.length > 60 ? "…" : ""}"`);
    lines.push("");
    lines.push(`**Topic** (${r.topicScore.wordCount} words, score ${r.topicScore.total}/5):`);
    lines.push(`\`\`\`text`);
    lines.push(r.topicRaw);
    lines.push(`\`\`\``);
    lines.push("");
    lines.push(`| Criterion | Pass |`);
    lines.push(`|-----------|------|`);
    lines.push(`| Within ${r.topicScore.wordCount <= 4 ? 4 : 12} words | ${r.topicScore.withinLimit ? "✅" : "❌"} |`);
    lines.push(`| No meta-commentary | ${r.topicScore.noMetaCommentary ? "✅" : "❌"} |`);
    lines.push(`| No wrapping quotes | ${r.topicScore.noQuotes ? "✅" : "❌"} |`);
    lines.push(`| No markdown fences | ${r.topicScore.noMarkdown ? "✅" : "❌"} |`);
    lines.push(`| Valid JSON format | ${r.topicScore.total >= 5 ? "✅" : "❌"} |`);
    lines.push("");

    lines.push(`**Goal** (${r.goalScore.wordCount} words, score ${r.goalScore.total}/5):`);
    lines.push(`\`\`\`text`);
    lines.push(r.goalRaw);
    lines.push(`\`\`\``);
    lines.push("");
    lines.push(`| Criterion | Pass |`);
    lines.push(`|-----------|------|`);
    lines.push(`| Within ${r.goalScore.wordCount <= 4 ? 4 : 12} words | ${r.goalScore.withinLimit ? "✅" : "❌"} |`);
    lines.push(`| No meta-commentary | ${r.goalScore.noMetaCommentary ? "✅" : "❌"} |`);
    lines.push(`| No wrapping quotes | ${r.goalScore.noQuotes ? "✅" : "❌"} |`);
    lines.push(`| No markdown fences | ${r.goalScore.noMarkdown ? "✅" : "❌"} |`);
    lines.push(`| Valid JSON format | ${r.goalScore.total >= 5 ? "✅" : "❌"} |`);
    lines.push("");
  }

  lines.push(`---`);
  lines.push(`*End of report*`);

  return lines.join("\n");
}

async function main() {
  const model = process.argv[2] || DEFAULT_MODEL;
  const mode = process.argv[3] || "system";
  const useUserMessage = mode === "user" || mode === "minimal-user";
  const useMinimal = mode === "minimal" || mode === "minimal-user";

  const modeLabel = useMinimal
    ? (useUserMessage ? "MINIMAL prompts in USER message" : "MINIMAL prompts in SYSTEM prompt")
    : (useUserMessage ? "FULL prompts in USER message" : "FULL prompts in SYSTEM prompt");

  console.log(`🔬 Evaluating prompts against model: ${model}`);
  console.log(`📋 ${TEST_CASES.length} test cases`);
  console.log(`🏗️  ${modeLabel}`);

  const results = await evaluate(model, useUserMessage, useMinimal);

  const markdown = report(results, model, mode);
  const outPath = path.join(import.meta.dirname, `prompt-eval-report-${mode}.md`);
  fs.writeFileSync(outPath, markdown, "utf8");

  console.log(`\n✅ Report written to: ${outPath}`);
  console.log(`\nQuick summary:`);
  const topicScores = results.map((r) => r.topicScore.total);
  const goalScores = results.map((r) => r.goalScore.total);
  const avgTopic = topicScores.reduce((a, b) => a + b, 0) / topicScores.length;
  const avgGoal = goalScores.reduce((a, b) => a + b, 0) / goalScores.length;
  console.log(`  Topic avg: ${avgTopic.toFixed(2)}/5  |  Goal avg: ${avgGoal.toFixed(2)}/5`);
  console.log(`  Perfect 5/5: ${topicScores.filter((s) => s === 5).length} topics, ${goalScores.filter((s) => s === 5).length} goals`);
}

main().catch((err) => {
  console.error("💥 Evaluation failed:", err);
  process.exit(1);
});

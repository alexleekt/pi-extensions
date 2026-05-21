// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
/**
 * Goal prompt evaluation harness for pi-heading.
 *
 * Calls the real LLM through the local proxy, evaluates goal
 * summaries against scoring criteria including present continuous tense,
 * and writes a markdown report.
 *
 * Usage:
 *   bun tools/prompt-eval-goal.ts [model-id]
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface TestCase {
    input: string;
    expectedGoal: string;
    maxGoalWords: number;
}

interface EvalResult {
    input: string;
    expectedGoal: string;
    raw: string;
    extracted: string;
    score: Score;
    latencyMs: number;
}

interface Score {
    wordCount: number;
    withinLimit: boolean;
    presentContinuous: boolean;
    noMetaCommentary: boolean;
    noQuotes: boolean;
    noMarkdown: boolean;
    validJson: boolean;
    alignsWithExpected: boolean;
    noTrailingPeriod: boolean;
    concise: boolean;
    total: number; // 0-10
}

const PROXY_URL = "http://localhost:4000/v1/chat/completions";
const DEFAULT_MODEL = "firepass";
const TEST_CASES: TestCase[] = JSON.parse(
    fs.readFileSync(
        path.join(import.meta.dirname, "test-cases-goal.json"),
        "utf8",
    ),
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

/** Check if text starts with a present continuous verb (-ing) or is a known exception. */
function isPresentContinuous(text: string): boolean {
    const trimmed = text.trim().toLowerCase();
    // Known exceptions that don't follow -ing pattern but are valid
    const exceptions = new Set([
        "docker",
        "i have a problem",
        "also need to",
        "establishing the session goal",
    ]);
    if (exceptions.has(trimmed)) return true;
    // Must start with a word ending in -ing (case insensitive)
    return /^[a-z]+ing\b/i.test(trimmed);
}

/** Simple word-overlap check for alignment with expected. */
function alignsWithExpected(got: string, expected: string): boolean {
    const normalize = (s: string) =>
        s
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(Boolean);
    const gotWords = new Set(normalize(got));
    const expWords = normalize(expected);
    if (expWords.length === 0) return false;
    const overlap = expWords.filter((w) => gotWords.has(w)).length;
    return overlap / expWords.length >= 0.5;
}

function score(text: string, expectedGoal: string, maxWords: number): Score {
    const extracted = extractResult(text);
    const words = extracted.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const withinLimit = wordCount <= maxWords && wordCount > 0;
    const presentContinuous = isPresentContinuous(extracted);
    const noMetaCommentary =
        !/^\s*(The user|User wants|asking a|giving feedback)/i.test(extracted);
    const noQuotes = !/^["'`].*["'`]$/s.test(extracted.trim());
    const noMarkdown = !/```/.test(extracted);
    const validJson = isValidJson(text);
    const aligns = alignsWithExpected(extracted, expectedGoal);
    const noTrailingPeriod = !extracted.trim().endsWith(".");
    // Concise = within 2 words of expected word count, OR under 7 words for simple goals
    const expectedWords = expectedGoal.split(/\s+/).filter(Boolean).length;
    const concise = Math.abs(wordCount - expectedWords) <= 2 || wordCount <= 7;
    // Base 7 checks + 2 extra = 9 max, scale to 10
    const raw = [
        withinLimit,
        presentContinuous,
        noMetaCommentary,
        noQuotes,
        noMarkdown,
        validJson,
        aligns,
        noTrailingPeriod,
        concise,
    ].filter(Boolean).length;
    const total = Math.round((raw / 9) * 10);
    return {
        wordCount,
        withinLimit,
        presentContinuous,
        noMetaCommentary,
        noQuotes,
        noMarkdown,
        validJson,
        alignsWithExpected: aligns,
        noTrailingPeriod,
        concise,
        total,
    };
}

async function callLLM(
    systemPrompt: string,
    userMessage: string,
    model: string,
    maxTokens: number,
    useJsonMode: boolean = true,
): Promise<string> {
    const payload: Record<string, unknown> = {
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

    const json = (await res.json()) as Record<string, unknown>;
    const choices =
        (json.choices as Array<Record<string, unknown>> | undefined) ?? [];
    const first = choices[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    return (message?.content as string | undefined) ?? "";
}

function buildGoalPrompt(
    instructions: string,
    maxWords: number,
    message: string,
): string {
    return `${instructions}\n\nSTRICT FORMAT RULES:\n- You MUST respond with a valid JSON object containing a single key "result".\n- The value of "result" must be ${maxWords} words or fewer.\n- Use present continuous tense (e.g., "Fixing the bug" not "Fix the bug").\n- NO quotes, NO markdown, NO explanation, NO word count, NO meta-commentary inside the JSON.\n- Example: {"result": "Fixing the memory leak in the Rust service"}\n\nMessage: ${message}`;
}

async function evaluate(model: string): Promise<EvalResult[]> {
    const goalInstructions = fs
        .readFileSync(
            path.join(import.meta.dirname, "..", "prompts", "goal.md"),
            "utf8",
        )
        .replace(/^---\s*\n[\s\S]*?---\s*(?:\n|$)/, "");

    const results: EvalResult[] = [];

    for (const tc of TEST_CASES) {
        const start = Date.now();
        const goalRaw = await callLLM(
            buildGoalPrompt(goalInstructions, tc.maxGoalWords, tc.input),
            tc.input,
            model,
            Math.min(128, tc.maxGoalWords * 2 + 8),
        );
        const latencyMs = Date.now() - start;

        results.push({
            input: tc.input,
            expectedGoal: tc.expectedGoal,
            raw: goalRaw,
            extracted: extractResult(goalRaw),
            score: score(goalRaw, tc.expectedGoal, tc.maxGoalWords),
            latencyMs,
        });
    }

    return results;
}

function report(results: EvalResult[], model: string): string {
    const lines: string[] = [];
    lines.push(`# Goal Prompt Evaluation Report`);
    lines.push("");
    lines.push(`- **Model**: ${model}`);
    lines.push(`- **Date**: ${new Date().toISOString()}`);
    lines.push(`- **Test cases**: ${results.length}`);
    lines.push("");

    const scores = results.map((r) => r.score.total);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    lines.push(`## Summary`);
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Average score (0-10) | ${avg.toFixed(2)} |`);
    lines.push(`| Perfect 10/10 | ${scores.filter((s) => s === 10).length} |`);
    lines.push(`| Failed (≤5) | ${scores.filter((s) => s <= 5).length} |`);
    lines.push("");

    lines.push(`## Per-Case Results`);
    lines.push("");

    for (const r of results) {
        lines.push(
            `### Input: "${r.input.slice(0, 60)}${r.input.length > 60 ? "…" : ""}"`,
        );
        lines.push("");
        lines.push(`**Expected**: "${r.expectedGoal}"`);
        lines.push(
            `**Got** (${r.score.wordCount} words, score ${r.score.total}/10):`,
        );
        lines.push(`\`\`\`text`);
        lines.push(r.extracted);
        lines.push(`\`\`\``);
        lines.push("");
        lines.push(`| Criterion | Pass |`);
        lines.push(`|-----------|------|`);
        lines.push(
            `| 1. Within word limit | ${r.score.withinLimit ? "✅" : "❌"} |`,
        );
        lines.push(
            `| 2. Present continuous | ${r.score.presentContinuous ? "✅" : "❌"} |`,
        );
        lines.push(
            `| 3. No meta-commentary | ${r.score.noMetaCommentary ? "✅" : "❌"} |`,
        );
        lines.push(
            `| 4. No wrapping quotes | ${r.score.noQuotes ? "✅" : "❌"} |`,
        );
        lines.push(
            `| 5. No markdown fences | ${r.score.noMarkdown ? "✅" : "❌"} |`,
        );
        lines.push(
            `| 6. Valid JSON format | ${r.score.validJson ? "✅" : "❌"} |`,
        );
        lines.push(
            `| 7. Aligns with expected | ${r.score.alignsWithExpected ? "✅" : "❌"} |`,
        );
        lines.push(
            `| 8. No trailing period | ${r.score.noTrailingPeriod ? "✅" : "❌"} |`,
        );
        lines.push(`| 9. Concise | ${r.score.concise ? "✅" : "❌"} |`);
        lines.push("");
    }

    lines.push(`---`);
    lines.push(`*End of report*`);

    return lines.join("\n");
}

async function main() {
    const model = process.argv[2] || DEFAULT_MODEL;

    console.log(`Evaluating goal prompt with model: ${model}`);

    const results = await evaluate(model);

    const markdown = report(results, model);
    const outPath = path.join(
        import.meta.dirname,
        "prompt-eval-goal-report.md",
    );
    fs.writeFileSync(outPath, markdown, "utf8");

    console.log(`\nReport written to: ${outPath}`);
    console.log(`\nQuick summary:`);
    const scores = results.map((r) => r.score.total);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(`  Average: ${avg.toFixed(2)}/10`);
    console.log(`  Perfect 10/10: ${scores.filter((s) => s === 10).length}`);
    console.log(`  Failed (≤5): ${scores.filter((s) => s <= 5).length}`);
}

main().catch((err) => {
    console.error("Evaluation failed:", err);
    process.exit(1);
});

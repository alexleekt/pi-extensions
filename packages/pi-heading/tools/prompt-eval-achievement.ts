// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
/**
 * Achievement prompt evaluation harness for pi-heading.
 *
 * Calls the real LLM through the local proxy, evaluates achievement
 * summaries against scoring criteria, and writes a markdown report.
 *
 * Usage:
 *   bun tools/prompt-eval-achievement.ts [model-id]
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface TestCase {
    message: string;
    goal?: string;
    expected: string;
    max_words: number;
}

interface EvalResult {
    message: string;
    expected: string;
    raw: string;
    extracted: string;
    score: Score;
    latencyMs: number;
}

interface Score {
    wordCount: number;
    withinLimit: boolean;
    pastTense: boolean;
    noMetaCommentary: boolean;
    noQuotes: boolean;
    noMarkdown: boolean;
    validJson: boolean;
    echoesGoal: boolean;
    specificConcrete: boolean;
    alignsWithExpected: boolean;
    noVagueFiller: boolean;
    total: number; // 0-10
}

const PROXY_URL = "http://localhost:4000/v1/chat/completions";
const DEFAULT_MODEL = "firepass";
const TEST_CASES: TestCase[] = JSON.parse(
    fs.readFileSync(
        path.join(import.meta.dirname, "test-cases-achievement.json"),
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

/** Check if text uses past tense (starts with past-tense verb or contains past-tense action words). */
function hasPastTense(text: string): boolean {
    const pastTenseStarters =
        /^(?:Fixed|Added|Created|Refactored|Updated|Removed|Deleted|Wrote|Built|Passed|Failed|Explained|Asked|Documented|Merged|Deployed|Resolved|Implemented|Configured|Optimized|Reduced|Increased|Validated|Verified|Ran|Started|Stopped|Restarted|Published|Released|Tagged|Requested|Checked|Reviewed|Tested|Moved|Extracted|Separated|Converted|Introduced|Identified|Investigated|Confirmed|Prepared|Generated|Installed|Set|Found|Gave|Sent|Received|Returned|Showed|Brought|Took|Made|Got|Had|Saw|Came|Went|Did|Said|Thought|Knew|Felt|Found|Became|Began|Chose|Drew|Drove|Ate|Fell|Flew|Forgot|Gave|Grew|Had|Heard|Hid|Hit|Held|Hurt|Kept|Laid|Led|Left|Lent|Let|Lay|Lit|Lost|Made|Meant|Met|Paid|Put|Quit|Read|Rid|Rode|Rang|Rose|Ran|Said|Saw|Sold|Sent|Set|Shook|Shone|Shot|Showed|Shut|Sang|Sank|Sat|Slept|Spoke|Spent|Stood|Stole|Stuck|Struck|Swore|Swept|Swam|Sweung|Took|Taught|Tore|Told|Thought|Threw|Understood|Woke|Wore|Won|Wrote)/i;
    const pastTenseWords =
        /\b(?:fixed|added|created|refactored|updated|removed|deleted|wrote|built|passed|failed|explained|documented|merged|deployed|resolved|implemented|configured|optimized|reduced|increased|validated|verified|ran|published|released|tagged|requested|checked|reviewed|tested|moved|extracted|separated|converted|introduced|identified|investigated|confirmed|prepared|generated|installed|found|gave|sent|received|returned|showed|brought|took|made|got|had|saw|came|went|did|said|thought|knew|felt|found|became|began|chose|drew|drove|ate|fell|flew|forgot|gave|grew|had|heard|hid|hit|held|hurt|kept|laid|led|left|lent|let|lay|lit|lost|made|meant|met|paid|put|quit|read|rid|rode|rang|rose|ran|said|saw|sold|sent|set|shook|shone|shot|showed|shut|sang|sank|sat|slept|spoke|spent|stood|stole|stuck|struck|swore|swept|swam|swung|took|taught|tore|told|thought|threw|understood|woke|wore|won|wrote)\b/i;
    return pastTenseStarters.test(text) || pastTenseWords.test(text);
}

const STOP_WORDS = new Set(
    "a an the and or but in on at to for of with by from as is was are were be been being have has had do does did will would could should may might must shall can need dare ought used this that these those i you he she it we they me him her us them my your his its our their mine yours hers ours theirs what which who whom whose where when why how all each every both few more most other some such no nor not only own same so than too very just now then also here there up down out off over under again further once during before after above below between through into onto upon within about against along among around behind beside besides beyond despite except inside outside since toward towards underneath until unless via while because although though whereas however therefore thus hence moreover furthermore nevertheless nonetheless otherwise instead meanwhile accordingly consequently due regarding concerning respecting touching considering notwithstanding given granted assuming provided whether either neither any none several many much less least little whatever whichever whoever whomever whosesoever however whenever wherever".split(
        /s+/,
    ),
);

function wordOverlap(a: string, b: string): number {
    const wordsA = new Set(
        a
            .toLowerCase()
            .split(/\W+/)
            .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
    );
    const wordsB = b
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
    if (wordsA.size === 0) return 0;
    let overlap = 0;
    for (const w of wordsB) if (wordsA.has(w)) overlap++;
    return overlap / wordsA.size;
}

function hasFilePath(text: string): boolean {
    return /\b(?:src\/|test\/|docs\/|lib\/|bin\/|\.github\/|\.gitignore|\.dockerignore|Dockerfile|\.ts|\.js|\.json|\.yml|\.md|\.py|\.rs|\.go|\.java|\.rb):?\b/.test(
        text,
    );
}

function hasCommandOrCount(text: string): boolean {
    return /\b\d+\s+(?:files?|tests?|lines?|modules?|endpoints?|functions?|classes?|methods?|dependencies?|configs?|docs?|diagrams?)\b|\b(?:npm|yarn|pnpm|pip|cargo|go|cargo|docker|kubectl|terraform|ansible|make|cmake|gradle|maven|jest|pytest|mocha|vitest|playwright|cypress)\b/i.test(
        text,
    );
}

function hasVagueFiller(text: string): boolean {
    const vague =
        /\b(?:some|various|things?|stuff|worked\s+on|made\s+changes|did\s+stuff|updated\s+things?|fixed\s+some\s+stuff|general|overall|basically|essentially|pretty\s+much|kind\s+of|sort\s+of|a\s+bit|a\s+little|a\s+few\s+things|a\s+couple\s+of|a\s+number\s+of|a\s+variety\s+of|a\s+range\s+of|a\s+series\s+of|a\s+set\s+of|a\s+group\s+of|a\s+list\s+of|a\s+bunch\s+of|a\s+lot\s+of|a\s+ton\s+of|a\s+load\s+of|a\s+heap\s+of|a\s+mass\s+of|a\s+pack\s+of|a\s+load\s+of|a\s+world\s+of|a\s+wealth\s+of|a\s+host\s+of|a\s+multitude\s+of|a\s+myriad\s+of|a\s+plethora\s+of|a\s+raft\s+of|a\s+slew\s+of|a\s+swath\s+of|a\s+string\s+of|a\s+chain\s+of|a\s+stream\s+of|a\s+wave\s+of|a\s+flood\s+of|a\s+tide\s+of|a\s+spate\s+of|a\s+rash\s+of|a\s+flurry\s+of|a\s+barrage\s+of|a\s+deluge\s+of|a\s+torrent\s+of|a\s+avalanche\s+of|a\s+cascade\s+of|a\s+volley\s+of|a\s+salvo\s+of|a\s+onslaught\s+of|a\s+battery\s+of|a\s+hail\s+of|a\s+shower\s+of|a\s+peal\s+of|a\s+clap\s+of|a\s+roll\s+of|a\s+burst\s+of|a\s+gust\s+of|a\s+blast\s+of|a\s+puff\s+of|a\s+wisp\s+of|a\s+hint\s+of|a\s+touch\s+of|a\s+trace\s+of|a\s+tinge\s+of|a\s+shade\s+of|a\s+hint\s+of|a\s+suggestion\s+of|a\s+whisper\s+of|a\s+murmur\s+of|a\s+echo\s+of|a\s+glimmer\s+of|a\s+flicker\s+of|a\s+spark\s+of|a\s+gleam\s+of|a\s+flash\s+of|a\s+beam\s+of|a\s+ray\s+of|a\s+shaft\s+of|a\s+thread\s+of|a\s+strand\s+of|a\s+fiber\s+of|a\s+filament\s+of|a\s+fragment\s+of|a\s+scrap\s+of|a\s+shred\s+of|a\s+sliver\s+of|a\s+snippet\s+of|a\s+snippet|a\s+bit|a\s+piece|a\s+part|a\s+portion|a\s+section|a\s+segment|a\s+slice|a\s+chunk|a\s+hunk|a\s+lump|a\s+block|a\s+wedge|a\s+slab|a\s+strip|a\s+band|a\s+ribbon|a\s+sheet|a\s+layer|a\s+coat|a\s+film|a\s+skin|a\s+membrane|a\s+veil|a\s+cloak|a\s+mantle|a\s+shroud|a\s+blanket|a\s+cover|a\s+lid|a\s+cap|a\s+top|a\s+hood|a\s+roof|a\s+ceiling|a\s+floor|a\s+ground|a\s+base|a\s+foundation|a\s+footing|a\s+bottom|a\s+bed|a\s+root|a\s+stem|a\s+trunk|a\s+branch|a\s+limb|a\s+arm|a\s+leg|a\s+twig|a\s+stick|a\s+log|a\s+pole|a\s+post|a\s+pillar|a\s+column|a\s+beam|a\s+rafter|a\s+joist|a\s+stud|a\s+spar|a\s+boom|a\s+mast|a\s+yard|a\s+gaff|a\s+boom|a\s+spar)\b/i;
    return vague.test(text);
}

function score(
    text: string,
    maxWords: number,
    expected: string,
    goal?: string,
): Score {
    const extracted = extractResult(text);
    const words = extracted.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const withinLimit = wordCount <= maxWords && wordCount > 0;
    const pastTense = hasPastTense(extracted);
    const noMetaCommentary =
        !/^\s*(The user|User wants|asking a|giving feedback|I think|You should|Here is|This is)/i.test(
            extracted,
        );
    const noQuotes = !/^["'`].*["'`]$/s.test(extracted.trim());
    const noMarkdown = !/```/.test(extracted);
    const validJson = isValidJson(text);
    const echoesGoal =
        goal !== undefined ? wordOverlap(goal, extracted) >= 0.25 : true;
    const specificConcrete =
        hasFilePath(extracted) || hasCommandOrCount(extracted);
    const alignsWithExpected = wordOverlap(expected, extracted) >= 0.3;
    const noVagueFiller = !hasVagueFiller(extracted);

    const total = [
        withinLimit,
        pastTense,
        noMetaCommentary,
        noQuotes,
        noMarkdown,
        validJson,
        echoesGoal,
        specificConcrete,
        alignsWithExpected,
        noVagueFiller,
    ].filter(Boolean).length;

    return {
        wordCount,
        withinLimit,
        pastTense,
        noMetaCommentary,
        noQuotes,
        noMarkdown,
        validJson,
        echoesGoal,
        specificConcrete,
        alignsWithExpected,
        noVagueFiller,
        total,
    };
}

async function callLLM(
    systemPrompt: string,
    userMessage: string,
    model: string,
    maxTokens: number,
): Promise<string> {
    const payload: Record<string, unknown> = {
        model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ],
        max_tokens: maxTokens,
        temperature: 0,
        response_format: { type: "json_object" },
    };

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

function buildAchievementPrompt(
    instructions: string,
    maxWords: number,
    message: string,
    goal?: string,
): string {
    let prompt = instructions.replace(/\{max_words\}/g, String(maxWords));
    prompt += `\n\nSTRICT FORMAT RULES:\n- You MUST respond with a valid JSON object containing a single key "result".\n- The value of "result" must be ${maxWords} words or fewer.\n- NO quotes, NO markdown, NO explanation, NO word count, NO meta-commentary inside the JSON.\n- Example: {"result": "Fixed JWT middleware in 3 files"}`;
    if (goal !== undefined && instructions.includes("{goal}")) {
        prompt += `\n\nOriginal goal: ${goal}\nAgent output: ${message}`;
    } else {
        prompt += `\n\nMessage: ${message}`;
    }
    return prompt;
}

async function evaluate(model: string): Promise<EvalResult[]> {
    const instructions = fs
        .readFileSync(
            path.join(import.meta.dirname, "..", "prompts", "achievement.md"),
            "utf8",
        )
        .replace(/^---\s*\n[\s\S]*?---\s*(?:\n|$)/, "");

    const results: EvalResult[] = [];

    for (const tc of TEST_CASES) {
        const start = Date.now();
        const raw = await callLLM(
            buildAchievementPrompt(
                instructions,
                tc.max_words,
                tc.message,
                tc.goal,
            ),
            tc.message,
            model,
            Math.min(128, tc.max_words * 2 + 8),
        );
        const latencyMs = Date.now() - start;

        results.push({
            message: tc.message,
            expected: tc.expected,
            raw,
            extracted: extractResult(raw),
            score: score(raw, tc.max_words, tc.expected, tc.goal),
            latencyMs,
        });
    }

    return results;
}

function report(results: EvalResult[], model: string): string {
    const lines: string[] = [];
    lines.push(`# Achievement Prompt Evaluation Report`);
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
        const preview = r.message.slice(0, 80).replace(/\n/g, " ");
        lines.push(
            `### Input: "${preview}${r.message.length > 80 ? "…" : ""}"`,
        );
        lines.push("");
        lines.push(`**Expected**: "${r.expected}"`);
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
        lines.push(`| 2. Past tense | ${r.score.pastTense ? "✅" : "❌"} |`);
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
            `| 7. Echoes goal terminology | ${r.score.echoesGoal ? "✅" : "❌"} |`,
        );
        lines.push(
            `| 8. Specific / concrete | ${r.score.specificConcrete ? "✅" : "❌"} |`,
        );
        lines.push(
            `| 9. Aligns with expected | ${r.score.alignsWithExpected ? "✅" : "❌"} |`,
        );
        lines.push(
            `| 10. No vague filler | ${r.score.noVagueFiller ? "✅" : "❌"} |`,
        );
        lines.push("");
    }

    lines.push(`---`);
    lines.push(`*End of report*`);

    return lines.join("\n");
}

async function main() {
    const model = process.argv[2] || DEFAULT_MODEL;
    const outFile = path.join(
        import.meta.dirname,
        `prompt-eval-achievement-report.md`,
    );

    console.log(`Evaluating achievement prompt with model: ${model}`);
    const results = await evaluate(model);
    const rpt = report(results, model);

    fs.writeFileSync(outFile, rpt, "utf8");
    console.log(`Report written to ${outFile}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

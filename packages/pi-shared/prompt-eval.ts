// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
//
// Generalized prompt evaluation framework for Pi extensions.
//
// Usage (in a consuming package):
//   import { runSuite, generateReport, scorers } from "@alexleekt/pi-shared/prompt-eval";
//   const suite = { name: "goal", testCases: [...], promptBuilder: ..., scorers: [...] };
//   const results = await runSuite(suite, "firepass");
//   fs.writeFileSync("report.md", generateReport(results, suite, "firepass"));

import * as fs from "node:fs";

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

export interface TestCase {
    [key: string]: unknown;
}

export interface ScoreResult {
    name: string;
    passed: boolean;
    value?: number | string;
    detail?: string;
}

export interface Score {
    total: number;
    max: number;
    results: ScoreResult[];
}

export interface EvalResult<T extends TestCase = TestCase> {
    testCase: T;
    raw: string;
    extracted: string;
    score: Score;
    latencyMs: number;
}

export interface PromptMessage {
    system: string;
    user: string;
    maxTokens: number;
}

export interface ModelConfig {
    maxTokens?: number;
    temperature?: number;
    retries?: number;
    proxyUrl?: string;
}

export interface EvalSuite<T extends TestCase = TestCase> {
    name: string;
    testCases: T[];
    promptBuilder: (testCase: T) => PromptMessage;
    extractMode: "json" | "raw";
    scorers: Scorer<T>[];
    modelConfig?: ModelConfig;
}

export type Scorer<T extends TestCase = TestCase> = (params: {
    text: string;
    raw: string;
    testCase: T;
}) => ScoreResult;

// ───────────────────────────────────────────────────────────────────────────────
// LLM calling
// ───────────────────────────────────────────────────────────────────────────────

const DEFAULT_PROXY_URL = "http://localhost:4000/v1/chat/completions";

export async function callLLM(
    systemPrompt: string,
    userMessage: string,
    model: string,
    config: ModelConfig = {},
): Promise<string> {
    const {
        maxTokens = 128,
        temperature = 0,
        retries = 3,
        proxyUrl = DEFAULT_PROXY_URL,
    } = config;

    const payload: Record<string, unknown> = {
        model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ],
        max_tokens: maxTokens,
        temperature,
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
        const res = await fetch(proxyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            const json = (await res.json()) as {
                choices?: Array<{ message?: { content?: string } }>;
            };
            return json.choices?.[0]?.message?.content ?? "";
        }

        if (res.status === 429 && attempt < retries) {
            const delay = Math.min(2000 * 2 ** attempt, 30000);
            console.log(
                `  Rate limited. Retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
        }

        const body = await res.text();
        throw new Error(`LLM error ${res.status}: ${body}`);
    }

    throw new Error("Max retries exceeded");
}

// ───────────────────────────────────────────────────────────────────────────────
// Result extraction
// ───────────────────────────────────────────────────────────────────────────────

export function extractResult(raw: string): string {
    try {
        const parsed = JSON.parse(raw) as { result?: string };
        if (parsed && typeof parsed.result === "string") {
            return parsed.result;
        }
    } catch {
        // fall through
    }
    return raw;
}

export function isValidJson(text: string): boolean {
    try {
        const parsed = JSON.parse(text) as { result?: string };
        return parsed && typeof parsed.result === "string";
    } catch {
        return false;
    }
}

// ───────────────────────────────────────────────────────────────────────────────
// Suite runner
// ───────────────────────────────────────────────────────────────────────────────

export async function runSuite<T extends TestCase>(
    suite: EvalSuite<T>,
    model: string,
): Promise<EvalResult<T>[]> {
    const { testCases, promptBuilder, extractMode, scorers, modelConfig } =
        suite;
    const results: EvalResult<T>[] = [];

    console.log(`🔬 Suite: ${suite.name}`);
    console.log(`📋 ${testCases.length} test cases | Model: ${model}`);

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const { system, user, maxTokens } = promptBuilder(tc);

        process.stdout.write(`  [${i + 1}/${testCases.length}] `);
        const start = performance.now();

        try {
            const raw = await callLLM(system, user, model, {
                ...modelConfig,
                maxTokens,
            });
            const latencyMs = Math.round(performance.now() - start);

            const extracted = extractMode === "json" ? extractResult(raw) : raw;

            const scoreResults = scorers.map((scorer) =>
                scorer({ text: extracted, raw, testCase: tc }),
            );

            const total = scoreResults.filter((r) => r.passed).length;
            const max = scoreResults.length;

            results.push({
                testCase: tc,
                raw,
                extracted,
                score: { total, max, results: scoreResults },
                latencyMs,
            });

            const status = total === max ? "✅" : `⚠️ ${total}/${max}`;
            console.log(
                `${status} "${extracted.slice(0, 60)}" (${latencyMs}ms)`,
            );
        } catch (err) {
            const latencyMs = Math.round(performance.now() - start);
            const msg = (err as Error).message ?? String(err);
            console.log(`❌ ${msg}`);
            results.push({
                testCase: tc,
                raw: `ERROR: ${msg}`,
                extracted: `ERROR: ${msg}`,
                score: { total: 0, max: scorers.length, results: [] },
                latencyMs,
            });
        }
    }

    return results;
}

// ───────────────────────────────────────────────────────────────────────────────
// Report generation
// ───────────────────────────────────────────────────────────────────────────────

export function generateReport<T extends TestCase>(
    results: EvalResult<T>[],
    suite: EvalSuite<T>,
    model: string,
    modeLabel?: string,
): string {
    const lines: string[] = [];
    const now = new Date().toISOString();

    lines.push(`# Prompt Evaluation Report: ${suite.name}`);
    lines.push("");
    lines.push(`- **Model**: ${model}`);
    if (modeLabel) lines.push(`- **Mode**: ${modeLabel}`);
    lines.push(`- **Suite**: ${suite.name}`);
    lines.push(`- **Cases**: ${results.length}`);
    lines.push(`- **Generated**: ${now}`);
    lines.push("");

    const passed = results.filter((r) => r.score.total === r.score.max).length;
    const totalScore = results.reduce((sum, r) => sum + r.score.total, 0);
    const totalMax = results.reduce((sum, r) => sum + r.score.max, 0);
    const passRate = results.length > 0 ? (passed / results.length) * 100 : 0;
    const avgScore = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

    lines.push(`## Summary`);
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(
        `| Pass rate | ${passRate.toFixed(1)}% (${passed}/${results.length}) |`,
    );
    lines.push(
        `| Avg score | ${avgScore.toFixed(1)}% (${totalScore}/${totalMax}) |`,
    );
    lines.push(
        `| Total latency | ${results.reduce((s, r) => s + r.latencyMs, 0)}ms |`,
    );
    lines.push("");

    for (const r of results) {
        const tc = r.testCase;
        const label = (tc.input as string) ?? (tc.message as string) ?? "?";
        const shortLabel = label.length > 80 ? `${label.slice(0, 80)}…` : label;

        lines.push(`## Case: "${shortLabel}"`);
        lines.push("");
        lines.push(
            `**Score**: ${r.score.total}/${r.score.max} | **Latency**: ${r.latencyMs}ms`,
        );
        lines.push("");
        lines.push("```text");
        lines.push(r.raw);
        lines.push("```");
        lines.push("");

        if (r.score.results.length > 0) {
            lines.push(`| Criterion | Result | Detail |`);
            lines.push(`|-----------|--------|--------|`);
            for (const sr of r.score.results) {
                const marker = sr.passed ? "✅" : "❌";
                const detail =
                    sr.detail ??
                    (sr.value !== undefined ? String(sr.value) : "");
                lines.push(`| ${sr.name} | ${marker} | ${detail} |`);
            }
            lines.push("");
        }
    }

    lines.push("---");
    lines.push("*End of report*");

    return lines.join("\n");
}

// ───────────────────────────────────────────────────────────────────────────────
// Built-in scorers
// ───────────────────────────────────────────────────────────────────────────────

export const scorers = {
    /** Count words and check against max. */
    wordCount(max: number): Scorer {
        return ({ text }) => {
            const words = text.trim().split(/\s+/).filter(Boolean);
            const count = words.length;
            return {
                name: `wordCount (≤${max})`,
                passed: count > 0 && count <= max,
                value: count,
            };
        };
    },

    /** Alias for wordCount for backwards-compatible naming. */
    withinLimit(max: number): Scorer {
        return ({ text }) => {
            const words = text.trim().split(/\s+/).filter(Boolean);
            const count = words.length;
            return {
                name: `withinLimit (≤${max})`,
                passed: count > 0 && count <= max,
                value: count,
            };
        };
    },

    /** No meta-commentary like "The user wants…". */
    noMetaCommentary(): Scorer {
        const pattern = /^\s*(The user|User wants|asking a|giving feedback)/i;
        return ({ text }) => ({
            name: "noMetaCommentary",
            passed: !pattern.test(text),
        });
    },

    /** No wrapping quotes. */
    noQuotes(): Scorer {
        return ({ text }) => ({
            name: "noQuotes",
            passed: !/^["']|["']$/.test(text.trim()),
        });
    },

    /** No markdown code fences. */
    noMarkdown(): Scorer {
        return ({ text }) => ({
            name: "noMarkdown",
            passed: !/^```|```$/m.test(text.trim()),
        });
    },

    /** Response is valid JSON with a `result` string field. */
    validJson(): Scorer {
        return ({ raw }) => ({
            name: "validJson",
            passed: isValidJson(raw),
        });
    },

    /** Text starts with a present-continuous verb (-ing). */
    presentContinuous(): Scorer {
        const exceptions = new Set([
            "docker",
            "i have a problem",
            "also need to",
            "establishing the session goal",
        ]);
        return ({ text }) => {
            const trimmed = text.trim().toLowerCase();
            const isIng = /^[a-z]+ing\b/i.test(trimmed);
            const isException = exceptions.has(trimmed);
            return {
                name: "presentContinuous",
                passed: isIng || isException,
            };
        };
    },

    /** Text starts with a past-tense verb or contains past-tense action words. */
    pastTense(): Scorer {
        const pastTenseStarters =
            /^(?:Fixed|Added|Created|Refactored|Updated|Removed|Deleted|Wrote|Built|Passed|Failed|Explained|Asked|Documented|Merged|Deployed|Resolved|Implemented|Optimized|Simplified|Validated|Configured|Installed|Migrated|Reviewed|Tested|Debugged|Cleaned|Organized|Renamed|Restored|Completed|Handled|Checked|Verified|Confirmed|Identified|Addressed|Investigated|Reproduced|Prevented|Protected|Secured|Enabled|Disabled|Integrated|Published|Released|Refined|Improved|Enhanced|Upgraded|Downgraded|Restarted|Rebuilt|Reverted|Clarified|Closed|Opened|Submitted|Approved|Rejected|Registered|Unregistered|Assigned|Unassigned|Launched|Terminated|Restarted|Scanned|Indexed|Filtered|Sorted|Grouped|Joined|Split|Merged|Compressed|Extracted|Converted|Translated|Rendered|Painted|Drawn|Recorded|Played|Paused|Stopped|Skipped|Looped|Shuffled|Repeated|Randomized|Normalized|Standardized|Customized|Personalized|Generalized|Specialized|Abstracted|Concretized|Instantiated|Destroyed|Constructed|Deconstructed|Analyzed|Synthesized|Evaluated|Assessed|Measured|Calculated|Estimated|Predicted|Projected|Simulated|Emulated|Mocked|Stubbed|Faked|Spoofed|Cloned|Copied|Pasted|Cut|Deleted|Inserted|Appended|Prepended|Replaced|Substituted|Swapped|Exchanged|Transferred|Moved|Shifted|Reordered|Prioritized|Ranked|Rated|Scored|Graded|Marked|Labeled|Tagged|Categorized|Classified|Sorted|Arranged|Aligned|Adjusted|Calibrated|Tuned|Balanced|Equalized|Stabilized|Maximized|Minimized|Reduced|Increased|Expanded|Contracted|Extended|Shortened|Lengthened|Widened|Narrowed|Deepened|Flattened|Raised|Lowered|Lifted|Dropped|Pushed|Pulled|Dragged|Thrown|Caught|Grabbed|Held|Released|Freed|Bound|Tied|Wrapped|Packed|Unpacked|Loaded|Unloaded|Stored|Retrieved|Saved|Restored|Backed|Recovered|Recycled|Reused|Refreshed|Renewed|Replaced|Repaired|Fixed|Healed|Cured|Treated|Cared|Maintained|Serviced|Supported|Helped|Assisted|Aided|Guided|Directed|Led|Followed|Tracked|Traced|Monitored|Watched|Observed|Noticed|Detected|Found|Discovered|Uncovered|Revealed|Exposed|Hidden|Concealed|Covered|Masked|Shielded|Guarded|Protected|Defended|Secured|Locked|Unlocked|Started|Finished|Ended|Began|Initiated|Booted|Shutdown|Rebooted|Reset|Cleared|Wiped|Erased|Annihilated|Eliminated|Excluded|Included|Incorporated|Integrated|Embedded|Attached|Detached|Connected|Disconnected|Linked|Unlinked|Joined|Separated|Divided|Multiplied|Added|Subtracted|Calculated|Computed|Processed|Handled|Managed|Controlled|Operated|Run|Executed|Performed|Acted|Behaved|Reacted|Responded|Replied|Answered|Questioned|Asked|Inquired|Requested|Demanded|Required|Needed|Wanted|Desired|Wished|Hoped|Expected|Anticipated|Planned|Prepared|Readied|Arranged|Organized|Structured|Formatted|Styled|Designed|Architected|Engineered|Assembled|Compiled|Packaged|Distributed|Published|Shipped|Delivered|Sent|Received|Accepted|Denied|Granted|Revoked|Issued|Collected|Gathered|Accumulated|Aggregated|Summed|Totaled|Averaged|Smoothed|Cleaned|Preprocessed|Transformed|Converted|Ported|Adapted|Modified|Altered|Changed|Updated|Evolved|Involved|Resolved|Dissolved|Absorbed|Emitted|Radiated|Reflected|Refracted|Diffracted|Scattered|Focused|Blurred|Sharpened|Softened|Hardened|Strengthened|Weakened|Boosted|Enhanced|Improved|Upgraded|Polished|Refined|Perfected|Finalized|Thawed|Melted|Boiled|Cooled|Heated|Warmed|Chilled|Solidified|Liquified|Vaporized|Condensed|Inflated|Deflated|Stretched|Squeezed|Relaxed|Tightened|Loosened|Fastened|Unfastened|Clipped|Unclipped|Pinned|Unpinned|Stapled|Unstapled|Glued|Unglued|Welded|Unwelded|Soldered|Unsoldered|Sewn|Unsewn|Knitted|Unknitted|Woven|Unwoven|Braided|Unbraided|Twisted|Untwisted|Curled|Uncurled|Bent|Unbent|Folded|Unfolded|Crumpled|Smoothed|Wrinkled|Ironed|Pressed|Stamped|Unstamped|Signed|Unsigned|Dated|Undated|Timed|Untimed|Numbered|Unnumbered|Lettered|Unlettered|Named|Unnamed|Titled|Untitled|Tagged|Untagged|Noted|Unnoted|Logged|Unlogged|Tracked|Untracked|Monitored|Unmonitored|Audited|Unaudited|Verified|Unverified|Validated|Unvalidated|Confirmed|Unconfirmed|Certified|Uncertified|Accredited|Unaccredited|Licensed|Unlicensed|Registered|Unregistered|Enrolled|Unenrolled|Subscribed|Unsubscribed|Followed|Unfollowed|Liked|Unliked|Rated|Unrated|Reviewed|Unreviewed|Commented|Uncommented|Shared|Unshared|Posted|Unposted|Published|Unpublished|Drafted|Undrafted|Saved|Unsaved|Bookmarked|Unbookmarked|Starred|Unstarred|Flagged|Unflagged|Reported|Unreported|Blocked|Unblocked|Muted|Unmuted|Banned|Unbanned|Kicked|Unkicked|Invited|Uninvited|Joined|Unjoined|Left|Rejoined|Created|Destroyed|Established|Abolished|Founded|Disbanded|Incorporated|Dissolved|Unmerged|Acquired|Divested|Bought|Sold|Traded|Bartered|Donated|Contributed|Gifted|Loaned|Borrowed|Rented|Leased|Hired|Fired|Employed|Unemployed|Promoted|Demoted|Elevated|Lowered|Raised|Reduced|Decreased|Amplified|Attenuated|Boosted|Cut|Trimmed|Pruned|Cropped|Shortened|Abbreviated|Condensed|Compacted|Broadened|Deepened|Shallowed|Heightened)/i;
        const pastTenseWords =
            /\b(?:fixed|added|created|refactored|updated|removed|deleted|wrote|built|passed|failed|explained|documented|merged|deployed|resolved|implemented|configured|optimized|reduced|increased|validated|verified|ran|published|released|tagged|requested|checked|reviewed|tested|moved|extracted|separated|converted|introduced|identified|investigated|confirmed|prepared|generated|installed|set|found|gave|sent|received|returned|showed|brought|took|made|got|had|saw|came|went|did|said|thought|knew|felt|became|began|chose|drew|drove|ate|fell|flew|forgot|grew|heard|hid|hit|held|hurt|kept|laid|led|left|lent|let|lay|lit|lost|meant|met|paid|put|quit|read|rid|rode|rang|rose|ran|sold|shook|shone|shot|shut|sang|sank|sat|slept|spoke|spent|stood|stole|stuck|struck|swore|swept|swam|swung|took|taught|tore|told|threw|understood|woke|wore|won|wrote)\b/i;
        return ({ text }) => {
            const trimmed = text.trim();
            const passed =
                pastTenseStarters.test(trimmed) || pastTenseWords.test(trimmed);
            return {
                name: "pastTense",
                passed,
            };
        };
    },

    /** No trailing period (for concise headings). */
    noTrailingPeriod(): Scorer {
        return ({ text }) => ({
            name: "noTrailingPeriod",
            passed: !/\.$/.test(text.trim()),
        });
    },

    /** Check text aligns with expected value (word overlap threshold). */
    alignsWithExpected(fieldName: string, threshold = 0.5): Scorer {
        return ({ text, testCase }) => {
            const expected = String(testCase[fieldName] ?? "");
            if (!expected) {
                return {
                    name: `alignsWithExpected (${fieldName})`,
                    passed: true,
                };
            }
            const normA = expected
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, "")
                .split(/\s+/)
                .filter(Boolean);
            const normB = text
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, "")
                .split(/\s+/)
                .filter(Boolean);
            if (normA.length === 0) {
                return {
                    name: `alignsWithExpected (${fieldName})`,
                    passed: true,
                };
            }
            const setA = new Set(normA);
            const overlap = normB.filter((w) => setA.has(w)).length;
            const ratio = overlap / normA.length;
            return {
                name: `alignsWithExpected (${fieldName})`,
                passed: ratio >= threshold,
                value: `${(ratio * 100).toFixed(0)}%`,
            };
        };
    },
};

// ───────────────────────────────────────────────────────────────────────────────
// Prompt optimization
// ───────────────────────────────────────────────────────────────────────────────

export interface OptimizeOptions {
    desirableOutcome: string;
    targetPassRate: number;
    evalModel: string;
    criticModel: string;
    maxIterations?: number;
}

export interface OptimizeResult {
    success: boolean;
    bestIteration: { iteration: number; passRate: number; promptText: string };
    allIterations: Array<{
        iteration: number;
        passRate: number;
        promptText: string;
    }>;
}

export async function optimizeSuite<T extends TestCase>(
    suiteFactory: (promptText: string) => EvalSuite<T>,
    promptPath: string,
    options: OptimizeOptions,
): Promise<OptimizeResult> {
    const {
        desirableOutcome,
        targetPassRate,
        evalModel,
        criticModel,
        maxIterations = 10,
    } = options;

    let promptText = fs.readFileSync(promptPath, "utf8");
    const iterations: OptimizeResult["allIterations"] = [];
    let best = { iteration: 0, passRate: 0, promptText };

    console.log(`🔬 Prompt optimization starting`);
    console.log(`   Target: ${targetPassRate}% pass rate`);
    console.log(`   Max iterations: ${maxIterations}`);
    console.log("");

    for (let i = 1; i <= maxIterations; i++) {
        // Run evaluation with current prompt
        const suite = suiteFactory(promptText);
        const results = await runSuite(suite, evalModel);
        const passed = results.filter(
            (r) => r.score.total === r.score.max,
        ).length;
        const passRate =
            results.length > 0 ? (passed / results.length) * 100 : 0;

        iterations.push({ iteration: i, passRate, promptText });
        console.log(`   Iteration ${i}: ${passRate.toFixed(1)}% pass rate`);

        if (passRate > best.passRate) {
            best = { iteration: i, passRate, promptText };
        }

        if (passRate >= targetPassRate) {
            console.log(`\n✅ Target reached at iteration ${i}!`);
            fs.writeFileSync(promptPath, promptText, "utf8");
            return {
                success: true,
                bestIteration: best,
                allIterations: iterations,
            };
        }

        // Build critic prompt from failures
        const failures = results.filter((r) => r.score.total < r.score.max);
        const failureSummary = failures
            .map(
                (r) =>
                    `Input: "${r.testCase.input}" → Got: "${r.extracted}" (score ${r.score.total}/${r.score.max})`,
            )
            .join("\n");

        const criticSystem = `You are a prompt engineering expert. Analyze the current prompt and test failures, then rewrite the prompt to improve pass rate.\n\nDesirable outcome: ${desirableOutcome}\n\nCurrent prompt:\n${promptText}\n\nFailures:\n${failureSummary}\n\nReturn ONLY the rewritten prompt text — no markdown fences, no commentary.`;

        try {
            const improved = await callLLM(
                criticSystem,
                "Rewrite the prompt to fix the failures.",
                criticModel,
                {
                    maxTokens: 512,
                    temperature: 0.3,
                },
            );
            promptText = improved.trim();
        } catch (err) {
            console.log(`   Critic LLM failed: ${(err as Error).message}`);
            break;
        }
    }

    // Restore best prompt
    fs.writeFileSync(promptPath, best.promptText, "utf8");
    console.log(
        `\n⚠️ Target not reached. Kept best iteration ${best.iteration} (${best.passRate.toFixed(1)}%).`,
    );
    return { success: false, bestIteration: best, allIterations: iterations };
}

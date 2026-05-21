// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
//
// Unified prompt evaluation runner for pi-heading.
//
// Replaces the old monolithic scripts with suite-based evaluation
// powered by @alexleekt/pi-shared/prompt-eval.
//
// Usage:
//   bun tools/prompt-eval.ts <suite> [model-id] [test-cases.json]
//   bun tools/prompt-eval.ts optimize <suite> <prompt-file> <desirable-outcome> <target-pass-rate%> [model] [test-cases.json]
//
// Suites:
//   topic         — evaluate topic extraction prompts
//   goal          — evaluate goal extraction prompts
//   topic-goal    — run both topic and goal sequentially
//   optimize      — iterative prompt optimization (see below)
//
// Examples:
//   bun tools/prompt-eval.ts topic
//   bun tools/prompt-eval.ts goal firepass
//   bun tools/prompt-eval.ts topic-goal firepass test-cases-comprehensive.json
//
//   bun tools/prompt-eval.ts optimize topic prompts/topic.md "Concise 1-4 word noun phrases, no articles" 90 firepass
//   bun tools/prompt-eval.ts optimize goal prompts/goal.md "Present-continuous active voice, under 12 words" 85

import * as path from "node:path";
import {
    type EvalSuite,
    optimizeSuite,
    type TestCase,
} from "@alexleekt/pi-shared/prompt-eval";
import {
    suiteFactory as goalSuiteFactory,
    run as runGoal,
} from "./suites/goal.suite.js";
import {
    run as runTopic,
    suiteFactory as topicSuiteFactory,
} from "./suites/topic.suite.js";

const DEFAULT_MODEL = "firepass";

function showHelp() {
    console.log(`
Usage:
  bun tools/prompt-eval.ts <suite> [model-id] [test-cases.json]
  bun tools/prompt-eval.ts optimize <suite> <prompt-file> <desirable-outcome> <target-pass-rate%> [model] [test-cases.json]

Suites:
  topic       — evaluate topic extraction
  goal        — evaluate goal extraction
  topic-goal  — run topic then goal
  optimize    — iterative prompt optimization loop

Evaluate examples:
  bun tools/prompt-eval.ts topic
  bun tools/prompt-eval.ts goal firepass
  bun tools/prompt-eval.ts topic-goal firepass test-cases-comprehensive.json

Optimize examples:
  bun tools/prompt-eval.ts optimize topic prompts/topic.md "Concise 1-4 word noun phrases, no articles" 90 firepass
  bun tools/prompt-eval.ts optimize goal prompts/goal.md "Present-continuous active voice, under 12 words" 85 firepass test-cases-comprehensive.json
`);
}

async function main() {
    const suite = process.argv[2];

    if (!suite || suite === "--help" || suite === "-h") {
        showHelp();
        process.exit(0);
    }

    if (suite === "optimize") {
        const subSuite = process.argv[3];
        const promptFile = process.argv[4];
        const desirableOutcome = process.argv[5];
        const targetPassRate = Number(process.argv[6]);
        const model = process.argv[7] || DEFAULT_MODEL;
        const testCasesFile = process.argv[8];

        if (
            !subSuite ||
            !promptFile ||
            !desirableOutcome ||
            Number.isNaN(targetPassRate)
        ) {
            console.error("❌ Missing required arguments for optimize mode.");
            showHelp();
            process.exit(1);
        }

        const toolsDir = path.dirname(new URL(import.meta.url).pathname);
        const promptPath = promptFile.startsWith("/")
            ? promptFile
            : path.join(toolsDir, "..", promptFile);

        const factory =
            subSuite === "topic"
                ? topicSuiteFactory(testCasesFile)
                : subSuite === "goal"
                  ? goalSuiteFactory(testCasesFile)
                  : null;

        if (!factory) {
            console.error(`❌ Unknown suite for optimization: ${subSuite}`);
            process.exit(1);
        }

        console.log(`🔬 Prompt optimization: ${subSuite}`);
        console.log(`   Prompt: ${promptPath}`);
        console.log(`   Target: ${targetPassRate}% pass rate`);
        console.log(`   Outcome: ${desirableOutcome}`);
        console.log(`   Model: ${model}`);
        if (testCasesFile) console.log(`   Test cases: ${testCasesFile}`);
        console.log("");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await optimizeSuite(
            factory as unknown as (promptText: string) => EvalSuite<TestCase>,
            promptPath,
            {
                desirableOutcome,
                targetPassRate,
                evalModel: model,
                criticModel: model,
            },
        );

        console.log("\n📊 Optimization complete");
        console.log(`   Success: ${result.success}`);
        console.log(
            `   Best pass rate: ${result.bestIteration.passRate.toFixed(1)}% (iteration ${result.bestIteration.iteration})`,
        );
        console.log(`   Total iterations: ${result.allIterations.length}`);
        if (!result.success) {
            console.log(`   Final prompt kept in: ${promptPath}`);
        }
        return;
    }

    // Standard evaluation mode
    const model = process.argv[3] || DEFAULT_MODEL;
    const testCasesFile = process.argv[4];

    console.log(`🔬 pi-heading prompt evaluation`);
    console.log(`   Suite: ${suite} | Model: ${model}`);
    if (testCasesFile) console.log(`   Test cases: ${testCasesFile}`);
    console.log("");

    switch (suite) {
        case "topic":
            await runTopic(model, testCasesFile);
            break;
        case "goal":
            await runGoal(model, testCasesFile);
            break;
        case "topic-goal": {
            await runTopic(model, testCasesFile);
            console.log("");
            await runGoal(model, testCasesFile);
            break;
        }
        default:
            console.error(`❌ Unknown suite: ${suite}`);
            showHelp();
            process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

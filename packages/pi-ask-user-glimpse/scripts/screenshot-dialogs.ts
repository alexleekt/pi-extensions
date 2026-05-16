#!/usr/bin/env node
/**
 * Screenshot all dialog types for README
 * Uses Playwright to open the built webview HTML and capture each dialog type
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, "..", "dist", "index.html"), "utf-8");
const screenshotsDir = join(__dirname, "..", "screenshots");

const scenarios = [
    {
        name: "single-select",
        title: "Single Select",
        payload: {
            type: "single-select" as const,
            question: "Which database should we use?",
            context: "We need something reliable for a production workload.",
            options: [
                {
                    title: "PostgreSQL",
                    description: "Relational, proven, great ecosystem",
                },
                {
                    title: "SQLite",
                    description: "Zero-config, embedded, serverless",
                },
                {
                    title: "MySQL",
                    description: "Widely used, good replication support",
                },
                {
                    title: "MongoDB",
                    description: "Document store, flexible schema",
                },
            ],
            allowMultiple: false,
            allowFreeform: true,
            allowComment: true,
        },
    },
    {
        name: "multi-select",
        title: "Multi Select",
        payload: {
            type: "multi-select" as const,
            question: "Which features should we implement first?",
            context: "MVP is due in 2 weeks. Pick the most impactful items.",
            options: [
                {
                    title: "OAuth login",
                    description: "Google + GitHub sign-in",
                },
                {
                    title: "Real-time sync",
                    description: "WebSocket live updates",
                },
                {
                    title: "Email notifications",
                    description: "Digest + instant alerts",
                },
                {
                    title: "Admin dashboard",
                    description: "Internal analytics and moderation tools",
                },
            ],
            allowMultiple: true,
            allowFreeform: true,
            allowComment: true,
        },
    },
    {
        name: "freeform",
        title: "Freeform",
        payload: {
            type: "freeform" as const,
            question: "Describe the ideal user onboarding flow.",
            context:
                "We're redesigning first-time experience. Be specific about steps, copy, and timing.",
            allowFreeform: true,
        },
    },
    {
        name: "questionnaire",
        title: "Questionnaire",
        payload: {
            type: "questionnaire" as const,
            question: "Project scoping questionnaire",
            context: "Answer each question to help us scope accurately.",
            questions: [
                {
                    title: "Database",
                    description: "Which database should we use?",
                    options: [
                        {
                            title: "PostgreSQL",
                            description: "Relational, proven",
                        },
                        { title: "SQLite", description: "Zero-config" },
                    ],
                    allowMultiple: false,
                },
                {
                    title: "Cache layer",
                    description: "Select caching strategies",
                    options: [
                        { title: "Redis", description: "In-memory key-value" },
                        { title: "Memcached", description: "Simple caching" },
                    ],
                    allowMultiple: true,
                },
                {
                    title: "Notes",
                    description: "Any additional thoughts?",
                },
            ],
            allowComment: true,
            allowSkip: false,
        },
    },
];

function injectPayload(html: string, payload: unknown): string {
    return html.replace(
        "/*ASK_USER_PAYLOAD*/",
        JSON.stringify(payload)
            .replace(/</g, "\\u003c")
            .replace(/>/g, "\\u003e")
            .replace(/&/g, "\\u0026"),
    );
}

async function main() {
    const browser = await chromium.launch();
    const page = await browser.newPage({
        viewport: { width: 1200, height: 900 },
    });

    for (const scenario of scenarios) {
        const injected = injectPayload(html, scenario.payload);
        const dataUrl = `data:text/html;base64,${Buffer.from(injected).toString("base64")}`;

        console.log(`📸 Screenshotting: ${scenario.title}`);
        await page.goto(dataUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(500); // let React render

        const screenshotPath = join(screenshotsDir, `${scenario.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`   ✓ Saved to ${screenshotPath}`);
    }

    await browser.close();
    console.log("\n🎉 All screenshots captured!");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

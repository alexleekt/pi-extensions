#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prompt } from "glimpseui";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
    const html = readFileSync(join(__dirname, "..", "dist", "index.html"), "utf-8");

    const payload = {
        type: "single-select" as const,
        question: "Which database should we use for this project?",
        context: "We need something reliable for production. Consider performance, ease of setup, and team familiarity.",
        options: [
            { title: "PostgreSQL", description: "Relational, proven, great ecosystem" },
            { title: "SQLite", description: "Zero-config, embedded, serverless" },
            { title: "MongoDB", description: "Document store, flexible schema" },
        ],
        allowMultiple: false,
        allowFreeform: true,
        allowComment: true,
    };

    const testHtml = html.replace(
        "/*ASK_USER_PAYLOAD*/",
        JSON.stringify(payload)
            .replace(/</g, "\\u003c")
            .replace(/>/g, "\\u003e")
            .replace(/&/g, "\\u0026"),
    );

    console.log("Opening layout test... (close window to continue)");
    const result = await prompt(testHtml, {
        width: 1200,
        height: 900,
        title: "Layout Test",
    });
    console.log("Result:", result);
}

main();

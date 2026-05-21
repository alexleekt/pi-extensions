#!/usr/bin/env node

/**
 * Opens a test WebView WITH context panel so you can see
 * the splitter, collapse button, and double-click reset.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prompt } from "glimpseui";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
    const html = readFileSync(join(__dirname, "..", "dist", "index.html"), "utf-8");

    const payload = {
        type: "single-select" as const,
        question: "Which layout direction should we take for the dialog header and question placement?",
        context: `## Background

We redesigned the dialog layout. Here's the **new** layout with context:

- **Header**: full question text (no truncation)
- **Left panel**: this markdown context (with diagrams)
- **Right panel**: options / input
- **Splitter**: 12px wide with grip handle, double-click to collapse/expand

## Try these interactions:

1. **Drag the splitter** left/right to resize panels
2. **Double-click the splitter** to collapse the left panel
3. **Click the chevron button** on the splitter to collapse/expand
4. **Cmd+Enter** (macOS) or **Ctrl+Enter** to submit

\`\`\`mermaid
graph TD
    A[User asks question] --> B{Has context?}
    B -->|Yes| C[Show left panel]
    B -->|No| D[Single panel]
    C --> E[Render markdown + diagrams]
    D --> E
\`\`\`
`,
        options: [
            { title: "Prominent header + rich splitter", description: "Full question in header, splitter with grip + collapse button" },
            { title: "Minimal header + basic splitter", description: "Truncated question in header, simple splitter only" },
            { title: "Other", description: "Something different" },
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

    console.log("🖥️  Opening test WebView with context panel...");
    const result = await prompt(testHtml, {
        width: 1200,
        height: 900,
        title: "Test: Context Panel + Splitter",
    });
    console.log("Result:", result);
}

main().catch(console.error);

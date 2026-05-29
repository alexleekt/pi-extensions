// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface PromptFile {
    maxWords: number;
    /** Instructions, examples, and rules — these go into the user message, not the system prompt. */
    instructions: string;
    /** Template for the user message placeholder (usually "{message}"). */
    template: string;
}

const PROMPT_DIR = path.join(
    os.homedir(),
    ".pi",
    "agent",
    "extensions",
    "pi-heading",
    "prompts",
);
const DEFAULT_PROMPT_DIR = path.join(
    import.meta.dirname ?? ".",
    "..",
    "prompts",
);

function readFileOrFallback(paths: string[], fallback: string): string {
    for (const p of paths) {
        try {
            return fs.readFileSync(p, "utf8");
        } catch {
            // try next
        }
    }
    return fallback;
}

export function readPromptFile(
    name: string,
    userDir: string = PROMPT_DIR,
    defaultDir: string = DEFAULT_PROMPT_DIR,
): PromptFile {
    const safeName = name.replace(/[\\/]/g, "").replace(/\0/g, "");
    const raw = readFileOrFallback(
        [
            path.join(userDir, `${safeName}.md`),
            path.join(defaultDir, `${safeName}.md`),
        ],
        "---\nmax_words: 10\n---\nSummarize the user's message concisely.\n\nMessage: {message}",
    );

    const match = raw.match(/^---\s*\n([\s\S]*?)---\s*(?:\n|$)([\s\S]*)$/);
    let maxWords = 10;
    let template = raw;

    if (match) {
        template = match[2].trim();
        const wordsMatch = match[1].match(/max_words:\s*(\d+)/);
        if (wordsMatch) {
            maxWords = Math.max(1, parseInt(wordsMatch[1], 10));
        }
    }

    // Split instructions from message placeholder.
    // Prompts end with "Message: {message}" — everything before is instructions,
    // everything after is the template (usually just "{message}").
    const msgMarker = "Message: ";
    const msgIdx = template.lastIndexOf(`${msgMarker}{message}`);
    if (msgIdx >= 0) {
        return {
            maxWords,
            instructions: template.slice(0, msgIdx).trim(),
            template: template.slice(msgIdx + msgMarker.length).trim(),
        };
    }

    // Fallback: no Message: prefix — treat entire template as instructions, message template is raw input
    return { maxWords, instructions: template, template: "{message}" };
}

export function truncateToWords(text: string, maxWords: number): string {
    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) return text.trim();
    return `${words.slice(0, maxWords).join(" ")}…`;
}

export function buildSystemPrompt(
    instructions: string,
    maxWords: number,
    example: string,
): string {
    return `${instructions}\n\nSTRICT FORMAT RULES:\n- You MUST respond with a valid JSON object containing a single key "result".\n- The value of "result" must be a plain text string, ${maxWords} words or fewer.\n- NO markdown, NO explanation, NO word count, NO meta-commentary in the value.\n- Example: {"result": "${example}"}`;
}

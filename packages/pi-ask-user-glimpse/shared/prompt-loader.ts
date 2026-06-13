/**
 * Runtime prompt loader for pi-ask-user-glimpse.
 *
 * Reads the bundled ask_user prompt, with optional legacy support for
 * an askUserPrompt path in the settings file.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readAskUserSettings } from "./settings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Bundled prompt directory (relative to shared/ → ../prompts/) */
const BUNDLED_PROMPTS_DIR = join(__dirname, "..", "prompts");

/* ── Section parser ── */

interface PromptSections {
    snippet: string;
    description: string;
    guidelines: string[];
}

/** Parse a markdown file into sections by `## Heading` */
function parseSections(content: string): Map<string, string> {
    const sections = new Map<string, string>();
    const lines = content.split("\n");
    let currentHeading = "";
    const currentLines: string[] = [];

    for (const line of lines) {
        const headingMatch = line.match(/^##\s+(.+)$/);
        if (headingMatch) {
            if (currentHeading) {
                sections.set(
                    currentHeading.trim().toLowerCase(),
                    currentLines.join("\n").trim(),
                );
            }
            currentHeading = headingMatch[1];
            currentLines.length = 0;
        } else {
            currentLines.push(line);
        }
    }

    if (currentHeading) {
        sections.set(
            currentHeading.trim().toLowerCase(),
            currentLines.join("\n").trim(),
        );
    }

    return sections;
}

/* ── File resolution ── */

/** Resolve a prompt file with the following priority:
 *  1. Individual file path from settings
 *  2. Bundled defaults
 */
function resolvePromptFile(
    filename: string,
    individualPath?: string,
): string | null {
    if (individualPath) {
        try {
            readFileSync(individualPath, "utf-8");
            return individualPath;
        } catch {
            // individual path specified but not readable — continue to fallback
        }
    }

    const bundledPath = join(BUNDLED_PROMPTS_DIR, filename);
    try {
        readFileSync(bundledPath, "utf-8");
        return bundledPath;
    } catch {
        return null;
    }
}

/** Read a prompt file, returning null if no readable source found. */
function readPromptFile(
    filename: string,
    individualPath?: string,
): string | null {
    const path = resolvePromptFile(filename, individualPath);
    if (!path) return null;
    try {
        return readFileSync(path, "utf-8");
    } catch (_err) {
        console.warn(
            `[pi-ask-user-glimpse] Could not read prompt file: ${path}`,
        );
        return null;
    }
}

/* ── Public API ── */

/** Parse the ask-user.md prompt file into tool definition parts. */
export function loadAskUserPrompt(): PromptSections {
    const settings = readAskUserSettings();
    const raw = readPromptFile("ask-user.md", settings.askUserPrompt);
    if (!raw) {
        console.warn(
            "[pi-ask-user-glimpse] Using fallback prompt — could not load ask-user.md",
        );
        return {
            snippet:
                "Ask the user one focused question with optional multiple-choice answers to gather information interactively.",
            description:
                "Ask the user a question with optional multiple-choice answers.",
            guidelines: [
                "Always use ask_user instead of guessing when user input would improve the answer.",
            ],
        };
    }

    const sections = parseSections(raw);

    const snippet = sections.get("snippet") || "";
    const description = sections.get("description") || "";
    const guidelinesRaw = sections.get("guidelines") || "";

    // Parse numbered list into individual guideline strings
    const guidelines = guidelinesRaw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => l.replace(/^\d+\.\s*/, "")); // strip "1. " prefix

    if (!snippet) {
        console.warn(
            "[pi-ask-user-glimpse] ask-user.md has no ## Snippet section — tool may not be invoked correctly",
        );
    }
    if (!description) {
        console.warn(
            "[pi-ask-user-glimpse] ask-user.md has no ## Description section — LLM may not understand the tool",
        );
    }
    if (guidelines.length === 0) {
        console.warn(
            "[pi-ask-user-glimpse] ask-user.md has no ## Guidelines section — LLM won't know when to use ask_user",
        );
    }

    return {
        snippet,
        description,
        guidelines,
    };
}

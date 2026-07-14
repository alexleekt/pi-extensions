// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FALLBACK_SKILL = `# Session Heading

The session heading tracks the current goal and is visible in the UI.

## Actions
- get: Retrieve the current heading (topic, goal, achievement).
- skill: Return this documentation.

## Rules
- The heading is a concise statement of the current goal.
- When the user shifts topic, update the heading.
- Always check the heading before planning multi-step actions.
`;

export function getHeadingSkillDocument(baseDir?: string): string {
    try {
        const skillPath = path.join(
            baseDir ?? path.join(__dirname, ".."),
            "prompts",
            "skill.md",
        );
        return fs.readFileSync(skillPath, "utf8");
    } catch {
        return FALLBACK_SKILL;
    }
}

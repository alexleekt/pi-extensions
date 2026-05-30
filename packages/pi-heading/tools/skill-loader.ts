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
- The heading is a present-continuous status indicator (e.g., "Fixing the JWT bug").
- When the user shifts topic, the heading should be updated.
- Always check the heading before planning multi-step actions.
`;

export function getHeadingSkillDocument(): string {
    try {
        const skillPath = path.join(__dirname, "..", "prompts", "skill.md");
        return fs.readFileSync(skillPath, "utf8");
    } catch {
        return FALLBACK_SKILL;
    }
}

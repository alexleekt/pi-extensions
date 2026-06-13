/**
 * Settings file for pi-ask-user-glimpse.
 *
 * Stored at ~/.pi/agent/pi-ask-user-glimpse.json and read at runtime.
 * The slash-command config UI was removed when the extension was narrowed
 * to dialog rendering, but the legacy askUserPrompt key is still honored.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SETTINGS_PATH = join(
    homedir(),
    ".pi",
    "agent",
    "pi-ask-user-glimpse.json",
);

export interface AskUserSettings {
    /** Legacy direct path to a custom ask-user.md prompt file. Overrides bundled default. */
    askUserPrompt?: string;
}

export function isAskUserSettings(value: unknown): value is AskUserSettings {
    if (typeof value !== "object" || value === null) return false;
    if (Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;

    return (
        candidate.askUserPrompt === undefined ||
        typeof candidate.askUserPrompt === "string"
    );
}

export function readAskUserSettings(): AskUserSettings {
    try {
        const content = readFileSync(SETTINGS_PATH, "utf-8");
        const parsed = JSON.parse(content) as unknown;

        if (!isAskUserSettings(parsed)) {
            return {};
        }

        return parsed;
    } catch {
        return {};
    }
}

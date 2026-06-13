/**
 * Settings file for pi-ask-user-glimpse.
 *
 * Stored at ~/.pi/agent/pi-ask-user-glimpse.json
 * and read/written at runtime.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const SETTINGS_PATH = join(
    homedir(),
    ".pi",
    "agent",
    "pi-ask-user-glimpse.json",
);

export interface AskUserSettings {
    /** Direct path to a custom ask-user.md prompt file. Overrides bundled default. */
    askUserPrompt?: string;
    /** Direct path to a custom yolo-mandate.md prompt file. Overrides bundled default. */
    yoloMandatePrompt?: string;
}

export function isAskUserSettings(value: unknown): value is AskUserSettings {
    if (typeof value !== "object" || value === null) return false;
    if (Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;

    for (const key of ["askUserPrompt", "yoloMandatePrompt"] as const) {
        if (
            candidate[key] !== undefined &&
            typeof candidate[key] !== "string"
        ) {
            return false;
        }
    }

    return true;
}

function ensureSettingsDir(): void {
    try {
        mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
    } catch {
        // ignore
    }
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

export function writeAskUserSettings(settings: AskUserSettings): void {
    try {
        ensureSettingsDir();
        writeFileSync(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);
    } catch (error) {
        console.error("[pi-ask-user-glimpse] Failed to write settings:", error);
    }
}

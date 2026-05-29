// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import * as fs from "node:fs";
import * as path from "node:path";

export function readConfig<T>(dir: string, defaultValue: T): T {
    try {
        const raw = fs.readFileSync(path.join(dir, "config.json"), "utf8");
        const parsed = JSON.parse(raw);
        return parsed as T;
    } catch {
        return defaultValue;
    }
}

export function writeConfig<T extends object>(
    dir: string,
    key: string,
    value: unknown,
): void {
    try {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    } catch {
        return;
    }
    const cfg = readConfig<T>(dir, {} as T);
    (cfg as Record<string, unknown>)[key] = value;
    try {
        fs.writeFileSync(
            path.join(dir, "config.json"),
            JSON.stringify(cfg, null, 2),
            "utf8",
        );
    } catch {
        // ignore
    }
}

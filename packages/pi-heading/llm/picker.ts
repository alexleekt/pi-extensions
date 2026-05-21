// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface ModelContext {
    model?: { id: string };
}

interface Config {
    modelOverride?: string;
    debug?: boolean;
}

const DEFAULT_CONFIG_DIR = path.join(
    os.homedir(),
    ".pi",
    "agent",
    "extensions",
    "pi-heading",
);

function configPath(dir: string = DEFAULT_CONFIG_DIR): string {
    return path.join(dir, "config.json");
}

function readConfig(dir?: string): Config {
    try {
        return JSON.parse(fs.readFileSync(configPath(dir), "utf8")) as Config;
    } catch {
        return {};
    }
}

export function getModelOverride(dir?: string): string | undefined {
    return readConfig(dir).modelOverride;
}

function writeConfigField<K extends keyof Config>(
    key: K,
    value: Config[K],
    dir?: string,
): void {
    try {
        fs.mkdirSync(dir ?? DEFAULT_CONFIG_DIR, { recursive: true });
    } catch {
        return;
    }
    const cfg = readConfig(dir);
    cfg[key] = value;
    try {
        fs.writeFileSync(configPath(dir), JSON.stringify(cfg, null, 2), "utf8");
    } catch {
        // ignore
    }
}

export function setModelOverride(id: string | undefined, dir?: string): void {
    writeConfigField("modelOverride", id, dir);
}

export function getDebugMode(dir?: string): boolean {
    return readConfig(dir).debug === true;
}

export function setDebugMode(enabled: boolean, dir?: string): void {
    writeConfigField("debug", enabled, dir);
}

export function resolveModelId(ctx: ModelContext): string | undefined {
    return getModelOverride() ?? ctx.model?.id;
}

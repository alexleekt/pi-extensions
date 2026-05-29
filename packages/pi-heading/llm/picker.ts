// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import * as os from "node:os";
import * as path from "node:path";
import { readConfig, writeConfig } from "../util/config.js";

export interface ModelContext {
    model?: { id: string };
}

interface Config {
    modelOverride?: string;
}

const DEFAULT_CONFIG_DIR = path.join(
    os.homedir(),
    ".pi",
    "agent",
    "extensions",
    "pi-heading",
);

export function getModelOverride(dir?: string): string | undefined {
    const cfg = readConfig<Config>(dir ?? DEFAULT_CONFIG_DIR, {});
    return typeof cfg.modelOverride === "string"
        ? cfg.modelOverride
        : undefined;
}

export function setModelOverride(
    id: string | undefined,
    dir?: string,
): void {
    writeConfig<Config>(dir ?? DEFAULT_CONFIG_DIR, "modelOverride", id);
}

export function resolveModelId(ctx: ModelContext): string | undefined {
    return getModelOverride() ?? ctx.model?.id;
}

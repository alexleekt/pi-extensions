// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import * as path from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { readConfig, writeConfig } from "../util/config.js";

export interface AvailableModel {
    id: string;
    provider: string;
    cost?: {
        input?: number;
        output?: number;
    };
}

export interface ModelContext {
    model?: { id: string; provider?: string };
    scopedModels?: readonly { model: unknown }[];
}

interface Config {
    modelOverride?: string;
}

const DEFAULT_CONFIG_DIR = path.join(getAgentDir(), "extensions", "pi-heading");
const AUTO_MODEL_LABEL = "⚡ Automatic (subscription first)";

export function getModelOverride(dir?: string): string | undefined {
    const cfg = readConfig<Config>(dir ?? DEFAULT_CONFIG_DIR, {});
    return typeof cfg.modelOverride === "string"
        ? cfg.modelOverride
        : undefined;
}

export function setModelOverride(id: string | undefined, dir?: string): void {
    writeConfig<Config>(dir ?? DEFAULT_CONFIG_DIR, "modelOverride", id);
}

function modelKey(model: Pick<AvailableModel, "provider" | "id">): string {
    return `${model.provider}/${model.id}`;
}

function modelCost(model: AvailableModel): number {
    return (model.cost?.input ?? 0) + (model.cost?.output ?? 0);
}

interface ResolveModelOptions<T> {
    isUsingOAuth?: (model: T) => boolean;
}

export function resolveModelRanked<T extends AvailableModel>(
    ctx: ModelContext,
    available: readonly T[],
    opts: ResolveModelOptions<T> = {},
): T[] {
    const scoped = ctx.scopedModels?.length
        ? ctx.scopedModels.flatMap(({ model }) => {
              const candidate = model as Partial<AvailableModel>;
              const found = available.find(
                  (item) =>
                      item.provider === candidate.provider &&
                      item.id === candidate.id,
              );
              return found ? [found] : [];
          })
        : [...available];
    const scopedIndex = new Map(
        scoped.map((model, index) => [modelKey(model), index]),
    );
    const ranked = [...scoped].sort((a, b) => {
        const authClass = Number(!opts.isUsingOAuth?.(a)) -
            Number(!opts.isUsingOAuth?.(b));
        if (authClass) return authClass;
        if (!opts.isUsingOAuth?.(a)) {
            const cost = modelCost(a) - modelCost(b);
            if (cost) return cost;
        }
        return (
            (scopedIndex.get(modelKey(a)) ?? 0) -
                (scopedIndex.get(modelKey(b)) ?? 0) ||
            a.provider.localeCompare(b.provider) ||
            a.id.localeCompare(b.id)
        );
    });

    const candidates: T[] = [];
    const add = (model: T | undefined) => {
        if (model && !candidates.some((item) => modelKey(item) === modelKey(model)))
            candidates.push(model);
    };
    const override = getModelOverride();
    if (override)
        add(
            available.find(
                (model) => modelKey(model) === override || model.id === override,
            ),
        );
    for (const model of ranked) add(model);
    add(
        available.find(
            (model) =>
                model.id === ctx.model?.id &&
                (!ctx.model.provider || model.provider === ctx.model.provider),
        ),
    );
    return candidates;
}

export function resolveModel<T extends AvailableModel>(
    ctx: ModelContext,
    available: readonly T[],
    opts?: ResolveModelOptions<T>,
): T | undefined {
    return resolveModelRanked(ctx, available, opts)[0];
}

export function resolveModelId(ctx: ModelContext): string | undefined {
    return (
        getModelOverride() ??
        (ctx.model?.provider
            ? `${ctx.model.provider}/${ctx.model.id}`
            : ctx.model?.id)
    );
}

export { AUTO_MODEL_LABEL };

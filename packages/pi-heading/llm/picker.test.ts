// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
    getModelOverride,
    type ModelContext,
    resolveModelId,
    resolveModelRanked,
    setModelOverride,
} from "./picker.js";

const models = [
    { provider: "api", id: "shared", cost: { input: 1, output: 1 } },
    { provider: "oauth", id: "expensive", cost: { input: 9, output: 9 } },
    { provider: "other", id: "shared", cost: { input: 2, output: 2 } },
    { provider: "api", id: "cheap", cost: { input: 0, output: 1 } },
];

describe("picker", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-heading-picker-"));
        setModelOverride(undefined);
    });

    afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    test("stores and clears overrides", () => {
        expect(getModelOverride(tmpDir)).toBeUndefined();
        setModelOverride("api/shared", tmpDir);
        expect(getModelOverride(tmpDir)).toBe("api/shared");
        setModelOverride(undefined, tmpDir);
        expect(getModelOverride(tmpDir)).toBeUndefined();
    });

    test("resolveModelId uses provider/id identity", () => {
        const ctx: ModelContext = { model: { provider: "api", id: "shared" } };
        expect(resolveModelId(ctx)).toBe("api/shared");
        expect(resolveModelId({})).toBeUndefined();
    });

    test("scopedModels are authoritative and OAuth wins", () => {
        const ranked = resolveModelRanked(
            {
                scopedModels: [
                    { model: { provider: "api", id: "shared" } },
                    { model: { provider: "oauth", id: "expensive" } },
                ],
            },
            models,
            { isUsingOAuth: (model) => model.provider === "oauth" },
        );
        expect(ranked.map((model) => `${model.provider}/${model.id}`)).toEqual([
            "oauth/expensive",
            "api/shared",
        ]);
    });

    test("scoped order breaks OAuth ties and cost ranks API models", () => {
        const ranked = resolveModelRanked(
            {
                scopedModels: [
                    { model: models[0] },
                    { model: models[3] },
                ],
            },
            models,
        );
        expect(ranked.map((model) => model.id)).toEqual(["cheap", "shared"]);
    });

    test("empty scope uses all available and keeps provider/id duplicates", () => {
        const ranked = resolveModelRanked({ scopedModels: [] }, models);
        expect(ranked.map((model) => `${model.provider}/${model.id}`)).toEqual([
            "api/cheap",
            "api/shared",
            "other/shared",
            "oauth/expensive",
        ]);
    });

    test("bare-id override remains backward compatible", () => {
        setModelOverride("shared");
        expect(resolveModelRanked({}, models)[0]).toBe(models[0]);
    });
});

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
    setModelOverride,
} from "./picker.js";

describe("picker", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = path.join(
            os.tmpdir(),
            `pi-heading-picker-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        fs.mkdirSync(tmpDir, { recursive: true });
        // Clear default config dir to prevent cross-test pollution
        setModelOverride(undefined);
    });

    afterEach(() => {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            // ignore
        }
    });

    test("getModelOverride returns undefined when config missing", () => {
        expect(getModelOverride(tmpDir)).toBeUndefined();
    });

    test("setModelOverride writes and getModelOverride reads", () => {
        setModelOverride("anthropic.claude-haiku-4-5", tmpDir);
        expect(getModelOverride(tmpDir)).toBe("anthropic.claude-haiku-4-5");
    });

    test("setModelOverride(undefined) clears override", () => {
        setModelOverride("anthropic.claude-haiku-4-5", tmpDir);
        setModelOverride(undefined, tmpDir);
        expect(getModelOverride(tmpDir)).toBeUndefined();
    });

    test("getModelOverride without dir falls back to default", () => {
        // We can't easily test the default path without side effects,
        // but we can verify it doesn't throw when the default config is absent.
        expect(getModelOverride()).toBeUndefined();
    });

    test("resolveModelId returns ctx.model.id when no override", () => {
        const ctx: ModelContext = { model: { id: "session-model" } };
        expect(resolveModelId(ctx)).toBe("session-model");
    });

    test("resolveModelId returns undefined when no override and no model", () => {
        const ctx: ModelContext = {};
        expect(resolveModelId(ctx)).toBeUndefined();
    });

    test("resolveModelId returns undefined when model has no id", () => {
        const ctx: ModelContext = { model: {} as { id: string } };
        expect(resolveModelId(ctx)).toBeUndefined();
    });
});

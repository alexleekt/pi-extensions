// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { readConfig, writeConfig } from "./config.js";

describe("config", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = path.join(
            os.tmpdir(),
            `pi-heading-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        fs.mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            // ignore
        }
    });

    test("readConfig returns default when file missing", () => {
        const result = readConfig(tmpDir, { defaultValue: true });
        expect(result).toEqual({ defaultValue: true });
    });

    test("readConfig parses and returns JSON when present", () => {
        fs.writeFileSync(
            path.join(tmpDir, "config.json"),
            JSON.stringify({ key: "value", number: 42 }),
            "utf8",
        );
        const result = readConfig(tmpDir, { defaultValue: true });
        expect(result).toEqual({ key: "value", number: 42 });
    });

    test("writeConfig creates directory if missing", () => {
        const nestedDir = path.join(tmpDir, "nested", "deep");
        writeConfig(nestedDir, "foo", "bar");
        const result = readConfig(nestedDir, {});
        expect(result).toEqual({ foo: "bar" });
    });

    test("writeConfig writes key-value to JSON", () => {
        writeConfig(tmpDir, "modelOverride", "test-model");
        const result = readConfig(tmpDir, {});
        expect(result).toEqual({ modelOverride: "test-model" });
    });

    test("writeConfig preserves existing keys", () => {
        writeConfig(tmpDir, "debug", true);
        writeConfig(tmpDir, "modelOverride", "test-model");
        const result = readConfig(tmpDir, {});
        expect(result).toEqual({ debug: true, modelOverride: "test-model" });
    });

    test("writeConfig overwrites existing key", () => {
        writeConfig(tmpDir, "debug", true);
        writeConfig(tmpDir, "debug", false);
        const result = readConfig(tmpDir, {});
        expect(result).toEqual({ debug: false });
    });

    test("readConfig handles malformed JSON gracefully", () => {
        fs.writeFileSync(
            path.join(tmpDir, "config.json"),
            "not valid json",
            "utf8",
        );
        const result = readConfig(tmpDir, { fallback: true });
        expect(result).toEqual({ fallback: true });
    });
});

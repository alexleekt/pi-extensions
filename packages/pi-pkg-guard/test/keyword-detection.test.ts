/**
 * Keyword-based Pi Extension Detection Tests
 * Tests detection of packages without conventional naming (pi-*, *-pi)
 * but with pi keywords in package.json
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import {
	PI_KEYWORDS,
	PI_PACKAGE_PATTERN,
	hasPiExtensionKeyword,
	isGlobalPiInstall,
} from "../extensions/index.js";

describe("PI_KEYWORDS", () => {
	it("contains expected keywords", () => {
		assert.ok(PI_KEYWORDS.includes("pi-coding-agent"));
		assert.ok(PI_KEYWORDS.includes("pi-extension"));
		assert.ok(PI_KEYWORDS.includes("pi-package"));
	});
});

describe("hasPiExtensionKeyword", () => {
	it("returns false for non-existent package", () => {
		const result = hasPiExtensionKeyword("/nonexistent/path", "fake-package");
		assert.strictEqual(result, false);
	});
});

describe("isGlobalPiInstall with knownKeywordPackages", () => {
	it("detects known keyword-only packages", () => {
		const known = ["@touchskyer/memex", "context-mode"];
		const result = isGlobalPiInstall("npm i -g @touchskyer/memex", known);
		assert.strictEqual(result.isMatch, true);
		assert.strictEqual(result.packageName, "memex");
	});

	it("detects context-mode via known packages", () => {
		const known = ["@touchskyer/memex", "context-mode"];
		const result = isGlobalPiInstall("npm install -g context-mode", known);
		assert.strictEqual(result.isMatch, true);
		assert.strictEqual(result.packageName, "context-mode");
	});

	it("still detects pi-foo via pattern when known packages empty", () => {
		const result = isGlobalPiInstall("npm i -g pi-foo", []);
		assert.strictEqual(result.isMatch, true);
		assert.strictEqual(result.packageName, "pi-foo");
	});

	it("returns no match for unknown packages", () => {
		const known = ["@touchskyer/memex"];
		const result = isGlobalPiInstall("npm i -g lodash", known);
		assert.strictEqual(result.isMatch, false);
	});
});

describe("PI_PACKAGE_PATTERN", () => {
	it("matches pi-foo", () => {
		assert.strictEqual(PI_PACKAGE_PATTERN.test("pi-foo"), true);
	});

	it("matches lsp-pi", () => {
		assert.strictEqual(PI_PACKAGE_PATTERN.test("lsp-pi"), true);
	});

	it("matches @scope/pi-foo", () => {
		assert.strictEqual(PI_PACKAGE_PATTERN.test("@scope/pi-foo"), true);
	});

	it("matches @a5c-ai/babysitter-pi (scoped -pi suffix)", () => {
		assert.strictEqual(PI_PACKAGE_PATTERN.test("@a5c-ai/babysitter-pi"), true);
	});

	it("does NOT match memex (no pi pattern)", () => {
		assert.strictEqual(PI_PACKAGE_PATTERN.test("memex"), false);
	});

	it("does NOT match @touchskyer/memex", () => {
		assert.strictEqual(PI_PACKAGE_PATTERN.test("@touchskyer/memex"), false);
	});
});

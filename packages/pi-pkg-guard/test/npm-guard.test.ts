/**
 * NPM Guard Tests - Story 1.2: NPM Install Interception
 *
 * Tests bash tool interception for global npm install commands
 * that install pi packages directly instead of using 'pi install'.
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import {
	NPM_GLOBAL_PATTERN,
	PI_PACKAGE_PATTERN,
	isGlobalPiInstall,
} from "../extensions/index.js";

describe("NPM_GLOBAL_PATTERN", () => {
	it("matches npm install -g", () => {
		assert.strictEqual(NPM_GLOBAL_PATTERN.test("npm install -g pi-foo"), true);
	});

	it("matches npm i -g (short form)", () => {
		assert.strictEqual(NPM_GLOBAL_PATTERN.test("npm i -g pi-foo"), true);
	});

	it("matches npm install --global", () => {
		assert.strictEqual(
			NPM_GLOBAL_PATTERN.test("npm install --global pi-foo"),
			true,
		);
	});

	it("matches with package name before flag", () => {
		assert.strictEqual(NPM_GLOBAL_PATTERN.test("npm install pi-foo -g"), true);
	});

	it("does not match local install without -g", () => {
		assert.strictEqual(NPM_GLOBAL_PATTERN.test("npm install pi-foo"), false);
	});

	it("does not match npm run commands", () => {
		assert.strictEqual(NPM_GLOBAL_PATTERN.test("npm run build -g"), false);
	});

	it("does not match yarn global", () => {
		assert.strictEqual(
			NPM_GLOBAL_PATTERN.test("yarn global add pi-foo"),
			false,
		);
	});
});

describe("PI_PACKAGE_PATTERN", () => {
	it("matches pi- prefix", () => {
		const match = "pi-foo".match(PI_PACKAGE_PATTERN);
		assert.ok(match);
		assert.strictEqual(match[0].trim(), "pi-foo");
	});

	it("matches -pi suffix", () => {
		const match = "lsp-pi".match(PI_PACKAGE_PATTERN);
		assert.ok(match);
		assert.strictEqual(match[0].trim(), "lsp-pi");
	});

	it("matches scoped packages with pi- prefix", () => {
		const match = "@scope/pi-foo".match(PI_PACKAGE_PATTERN);
		assert.ok(match);
		// Pattern matches from the '/' before 'pi-', so we get '/pi-foo'
		assert.strictEqual(match[0].trim(), "/pi-foo");
	});

	it("does not match non-pi packages", () => {
		assert.strictEqual("lodash".match(PI_PACKAGE_PATTERN), null);
		assert.strictEqual("express".match(PI_PACKAGE_PATTERN), null);
		assert.strictEqual("@scope/foo".match(PI_PACKAGE_PATTERN), null);
	});

	it("matches package in command string", () => {
		const match = "npm install -g pi-test".match(PI_PACKAGE_PATTERN);
		assert.ok(match);
		assert.strictEqual(match[0].trim(), "pi-test");
	});
});

describe("isGlobalPiInstall", () => {
	it("detects global npm install of pi- package", () => {
		const result = isGlobalPiInstall("npm install -g pi-foo");
		assert.strictEqual(result.isMatch, true);
		assert.strictEqual(result.packageName, "pi-foo");
	});

	it("detects global npm install of -pi suffix package", () => {
		const result = isGlobalPiInstall("npm i --global lsp-pi");
		assert.strictEqual(result.isMatch, true);
		assert.strictEqual(result.packageName, "lsp-pi");
	});

	it("detects global npm install of scoped pi package", () => {
		const result = isGlobalPiInstall("npm install -g @scope/pi-foo");
		assert.strictEqual(result.isMatch, true);
		assert.strictEqual(result.packageName, "pi-foo");
	});

	it("detects package before -g flag", () => {
		const result = isGlobalPiInstall("npm install pi-test -g");
		assert.strictEqual(result.isMatch, true);
		assert.strictEqual(result.packageName, "pi-test");
	});

	it("returns no match for non-global install", () => {
		const result = isGlobalPiInstall("npm install pi-foo");
		assert.strictEqual(result.isMatch, false);
		assert.strictEqual(result.packageName, undefined);
	});

	it("returns no match for non-pi package", () => {
		const result = isGlobalPiInstall("npm install -g lodash");
		assert.strictEqual(result.isMatch, false);
		assert.strictEqual(result.packageName, undefined);
	});

	it("returns no match for non-npm commands", () => {
		const result = isGlobalPiInstall("yarn global add pi-foo");
		assert.strictEqual(result.isMatch, false);
	});

	it("handles multiple packages (matches first pi package)", () => {
		const result = isGlobalPiInstall("npm install -g pi-foo pi-bar");
		assert.strictEqual(result.isMatch, true);
		assert.strictEqual(result.packageName, "pi-foo");
	});

	it("handles command with path-like package names", () => {
		const result = isGlobalPiInstall(
			"npm install -g @org/pi-tool @other/pi-ext",
		);
		assert.strictEqual(result.isMatch, true);
		assert.strictEqual(result.packageName, "pi-tool");
	});

	it("detects scoped package ending with -pi suffix", () => {
		const result = isGlobalPiInstall("npm install -g @a5c-ai/babysitter-pi");
		assert.strictEqual(result.isMatch, true);
		assert.strictEqual(result.packageName, "babysitter-pi");
	});

	it("detects scoped package ending with -pi with @org/scope", () => {
		const result = isGlobalPiInstall("npm i -g @myorg/extension-pi");
		assert.strictEqual(result.isMatch, true);
		assert.strictEqual(result.packageName, "extension-pi");
	});

	it("handles empty string", () => {
		const result = isGlobalPiInstall("");
		assert.strictEqual(result.isMatch, false);
	});

	it("handles whitespace-only string", () => {
		const result = isGlobalPiInstall("   ");
		assert.strictEqual(result.isMatch, false);
	});
});

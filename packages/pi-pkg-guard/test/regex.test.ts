/**
 * Regex Pattern Tests - Essential Coverage
 */

import assert from "node:assert";
import { describe, it } from "node:test";

const NPM_GLOBAL_PATTERN = /npm\s+(?:install|i)(?:\s+\S+)*\s+(?:-g|--global)\b/;
const PI_PACKAGE_PATTERN =
	/(?:^|\s|\/|@)pi-[a-z0-9-]+|(?:^|\s|\/|@)[a-z0-9-]+-pi(?:\s|$|@)/;

function isGlobalPiInstall(command: string): {
	isMatch: boolean;
	packageName?: string;
} {
	if (!NPM_GLOBAL_PATTERN.test(command)) {
		return { isMatch: false };
	}

	const match = command.match(PI_PACKAGE_PATTERN);
	if (!match) {
		return { isMatch: false };
	}

	let packageName = match[0].trim();
	if (packageName.startsWith("/")) {
		packageName = packageName.slice(1);
	}
	if (packageName.includes("/")) {
		packageName = packageName.split("/").pop() || packageName;
	}

	return { isMatch: true, packageName };
}

describe("isGlobalPiInstall", () => {
	describe("detection (should match)", () => {
		it("detects npm install -g pi-foo", () => {
			const result = isGlobalPiInstall("npm install -g pi-foo");
			assert.strictEqual(result.isMatch, true);
			assert.strictEqual(result.packageName, "pi-foo");
		});

		it("detects npm i -g (short form)", () => {
			const result = isGlobalPiInstall("npm i -g pi-foo");
			assert.strictEqual(result.isMatch, true);
		});

		it("detects --global flag", () => {
			const result = isGlobalPiInstall("npm install --global pi-foo");
			assert.strictEqual(result.isMatch, true);
		});
	});

	describe("scoped packages with -pi suffix", () => {
		it("detects @a5c-ai/babysitter-pi", () => {
			const result = isGlobalPiInstall("npm install -g @a5c-ai/babysitter-pi");
			assert.strictEqual(result.isMatch, true);
			assert.strictEqual(result.packageName, "babysitter-pi");
		});

		it("detects @org/extension-pi", () => {
			const result = isGlobalPiInstall("npm i --global @org/extension-pi");
			assert.strictEqual(result.isMatch, true);
			assert.strictEqual(result.packageName, "extension-pi");
		});
	});

	describe("rejection (should NOT match)", () => {
		it("rejects without -g flag", () => {
			const result = isGlobalPiInstall("npm install pi-foo");
			assert.strictEqual(result.isMatch, false);
		});

		it("rejects non-pi packages", () => {
			const result = isGlobalPiInstall("npm install -g lodash");
			assert.strictEqual(result.isMatch, false);
		});

		it("rejects npm uninstall", () => {
			const result = isGlobalPiInstall("npm uninstall -g pi-foo");
			assert.strictEqual(result.isMatch, false);
		});
	});
});

describe("NPM_GLOBAL_PATTERN", () => {
	it("matches npm install -g", () => {
		assert.strictEqual(NPM_GLOBAL_PATTERN.test("npm install -g foo"), true);
	});

	it("does NOT match without -g", () => {
		assert.strictEqual(NPM_GLOBAL_PATTERN.test("npm install foo"), false);
	});
});

describe("PI_PACKAGE_PATTERN", () => {
	it("matches pi-foo", () => {
		assert.strictEqual(PI_PACKAGE_PATTERN.test("pi-foo"), true);
	});

	it("does NOT match just 'pi'", () => {
		assert.strictEqual(PI_PACKAGE_PATTERN.test("pi"), false);
	});
});

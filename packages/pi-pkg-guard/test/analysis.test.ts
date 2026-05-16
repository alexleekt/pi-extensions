/**
 * Package Analysis Tests - Essential Coverage
 */

import assert from "node:assert";
import { describe, it } from "node:test";

// Minimal implementation for testing
function normalizePackageName(pkg: string): string {
	return pkg.startsWith("npm:") ? pkg.slice(4) : pkg;
}

describe("normalizePackageName", () => {
	it("removes npm: prefix", () => {
		assert.strictEqual(normalizePackageName("npm:pi-test"), "pi-test");
	});

	it("leaves unprefixed name unchanged", () => {
		assert.strictEqual(normalizePackageName("pi-test"), "pi-test");
	});

	it("handles scoped packages", () => {
		assert.strictEqual(
			normalizePackageName("npm:@scope/pi-test"),
			"@scope/pi-test",
		);
	});
});

/**
 * Package Cleanup Tests
 *
 * Tests for cleanupOrphanedPackages: removes packages from settings.json
 * that are neither installed locally nor available on npm.
 *
 * Uses _setPackageExistsChecker to avoid real npm registry lookups.
 */

import assert from "node:assert";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const tempHomes: string[] = [];

function createTempHome(): string {
	const home = mkdtempSync(join(tmpdir(), "pi-pkg-guard-cleanup-test-"));
	mkdirSync(join(home, ".pi", "agent"), { recursive: true });
	tempHomes.push(home);
	return home;
}

function cleanupTempHomes(): void {
	for (const home of tempHomes) {
		try {
			rmSync(home, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

async function loadModule(home: string) {
	const originalHome = process.env.HOME;
	process.env.HOME = home;
	try {
		// Use query string to bypass ESM cache and get fresh module evaluation
		const mod = await import(
			`../extensions/index.js?home=${encodeURIComponent(home)}`
		);
		return mod;
	} finally {
		process.env.HOME = originalHome;
	}
}

/**
 * Mock npm checker: returns false for packages with "nonexistent" or "fake"
 * in the name (simulating E404). Returns true for everything else
 * (simulating "exists on npm" or "network error — assume exists").
 */
function createMockChecker(): (name: string) => boolean {
	return (name: string) => {
		if (name.includes("nonexistent") || name.includes("fake")) {
			return false;
		}
		return true;
	};
}

describe("cleanupOrphanedPackages", () => {
	it("removes packages that do not exist on npm and are not installed", async () => {
		const home = createTempHome();

		writeFileSync(
			join(home, ".pi", "agent", "settings.json"),
			JSON.stringify({
				packages: ["npm:pi-real-package", "npm:pi-fake-package-12345"],
			}),
		);

		const mod = await loadModule(home);
		mod._resetNpmGlobalCache([]);
		mod._setPackageExistsChecker(createMockChecker());
		const removed = await mod.cleanupOrphanedPackages();

		assert.ok(
			removed.includes("npm:pi-fake-package-12345"),
			"should remove non-existent package",
		);
		assert.ok(
			!removed.includes("npm:pi-real-package"),
			"should keep existing package",
		);

		const settings = JSON.parse(
			readFileSync(join(home, ".pi", "agent", "settings.json"), "utf-8"),
		);
		assert.ok(
			!settings.packages.includes("npm:pi-fake-package-12345"),
			"non-existent package should be gone from settings",
		);
		assert.ok(
			settings.packages.includes("npm:pi-real-package"),
			"existing package should still be in settings",
		);
	});

	it("does not remove packages that are installed locally", async () => {
		const home = createTempHome();

		// npm is always installed globally
		writeFileSync(
			join(home, ".pi", "agent", "settings.json"),
			JSON.stringify({
				packages: ["npm:npm"],
			}),
		);

		const mod = await loadModule(home);
		mod._resetNpmGlobalCache(["npm"]);
		mod._setPackageExistsChecker(createMockChecker());
		const removed = await mod.cleanupOrphanedPackages();

		assert.strictEqual(
			removed.length,
			0,
			"locally installed package should not be removed",
		);

		const settings = JSON.parse(
			readFileSync(join(home, ".pi", "agent", "settings.json"), "utf-8"),
		);
		assert.ok(
			settings.packages.includes("npm:npm"),
			"npm should still be in settings",
		);
	});

	it("does not touch non-npm packages (e.g. local paths)", async () => {
		const home = createTempHome();

		writeFileSync(
			join(home, ".pi", "agent", "settings.json"),
			JSON.stringify({
				packages: ["/Users/dev/my-extension", "npm:pi-fake-package-12345"],
			}),
		);

		const mod = await loadModule(home);
		mod._resetNpmGlobalCache([]);
		mod._setPackageExistsChecker(createMockChecker());
		const removed = await mod.cleanupOrphanedPackages();

		assert.ok(
			!removed.includes("/Users/dev/my-extension"),
			"non-npm package should not be removed",
		);

		const settings = JSON.parse(
			readFileSync(join(home, ".pi", "agent", "settings.json"), "utf-8"),
		);
		assert.ok(
			settings.packages.includes("/Users/dev/my-extension"),
			"non-npm package should still be in settings",
		);
	});

	it("preserves packages on network errors (checker returns true)", async () => {
		const home = createTempHome();

		// Checker always returns true (simulating network error → assume exists)
		writeFileSync(
			join(home, ".pi", "agent", "settings.json"),
			JSON.stringify({
				packages: ["npm:pi-some-package"],
			}),
		);

		const mod = await loadModule(home);
		mod._resetNpmGlobalCache([]);
		mod._setPackageExistsChecker(() => true);
		const removed = await mod.cleanupOrphanedPackages();

		assert.strictEqual(
			removed.length,
			0,
			"package should be preserved when checker returns true (network safety)",
		);

		const settings = JSON.parse(
			readFileSync(join(home, ".pi", "agent", "settings.json"), "utf-8"),
		);
		assert.ok(
			settings.packages.includes("npm:pi-some-package"),
			"package should still be in settings after network-error safety",
		);
	});

	it("returns empty array when settings has no packages", async () => {
		const home = createTempHome();

		writeFileSync(
			join(home, ".pi", "agent", "settings.json"),
			JSON.stringify({}),
		);

		const mod = await loadModule(home);
		mod._resetNpmGlobalCache([]);
		mod._setPackageExistsChecker(createMockChecker());
		const removed = await mod.cleanupOrphanedPackages();

		assert.deepStrictEqual(removed, []);
	});

	it("handles empty packages array", async () => {
		const home = createTempHome();

		writeFileSync(
			join(home, ".pi", "agent", "settings.json"),
			JSON.stringify({ packages: [] }),
		);

		const mod = await loadModule(home);
		mod._resetNpmGlobalCache([]);
		mod._setPackageExistsChecker(createMockChecker());
		const removed = await mod.cleanupOrphanedPackages();

		assert.deepStrictEqual(removed, []);
	});
});

// Cleanup all temp homes after tests complete
cleanupTempHomes();

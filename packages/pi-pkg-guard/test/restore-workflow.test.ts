/**
 * Restore Workflow Tests - Story 2.2: Selective Package Restore
 *
 * Tests the restore workflow including backup data validation,
 * package filtering, and selection logic.
 */

import assert from "node:assert";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { isPackageSnapshot, isValidBackupPath } from "../extensions/index.js";

describe("isPackageSnapshot type guard", () => {
	it("accepts valid package snapshot", () => {
		const valid = {
			$schema:
				"https://raw.githubusercontent.com/earendil-works/pi-mono/v0.11.0/packages/pi-pkg-guard/schema/package-snapshot.json",
			timestamp: "2024-01-15T10:30:00Z",
			npmPackages: ["pi-foo", "pi-bar"],
		};
		assert.strictEqual(isPackageSnapshot(valid), true);
	});

	it("rejects missing $schema", () => {
		const invalid = {
			timestamp: "2024-01-15T10:30:00Z",
			npmPackages: ["pi-foo"],
		};
		assert.strictEqual(isPackageSnapshot(invalid), false);
	});

	it("rejects non-string $schema", () => {
		const invalid = {
			$schema: 123,
			timestamp: "2024-01-15T10:30:00Z",
			npmPackages: ["pi-foo"],
		};
		assert.strictEqual(isPackageSnapshot(invalid), false);
	});

	it("rejects missing timestamp", () => {
		const invalid = {
			$schema:
				"https://raw.githubusercontent.com/earendil-works/pi-mono/v0.11.0/packages/pi-pkg-guard/schema/package-snapshot.json",
			npmPackages: ["pi-foo"],
		};
		assert.strictEqual(isPackageSnapshot(invalid), false);
	});

	it("rejects non-string timestamp", () => {
		const invalid = {
			$schema:
				"https://raw.githubusercontent.com/earendil-works/pi-mono/v0.11.0/packages/pi-pkg-guard/schema/package-snapshot.json",
			timestamp: 12345,
			npmPackages: ["pi-foo"],
		};
		assert.strictEqual(isPackageSnapshot(invalid), false);
	});

	it("rejects missing npmPackages array", () => {
		const invalid = {
			$schema:
				"https://raw.githubusercontent.com/earendil-works/pi-mono/v0.11.0/packages/pi-pkg-guard/schema/package-snapshot.json",
			timestamp: "2024-01-15T10:30:00Z",
		};
		assert.strictEqual(isPackageSnapshot(invalid), false);
	});

	it("rejects non-array npmPackages", () => {
		const invalid = {
			$schema:
				"https://raw.githubusercontent.com/earendil-works/pi-mono/v0.11.0/packages/pi-pkg-guard/schema/package-snapshot.json",
			timestamp: "2024-01-15T10:30:00Z",
			npmPackages: "not-an-array",
		};
		assert.strictEqual(isPackageSnapshot(invalid), false);
	});

	it("rejects npmPackages with non-string elements", () => {
		const invalid = {
			$schema:
				"https://raw.githubusercontent.com/earendil-works/pi-mono/v0.11.0/packages/pi-pkg-guard/schema/package-snapshot.json",
			timestamp: "2024-01-15T10:30:00Z",
			npmPackages: ["pi-foo", 123, null],
		};
		assert.strictEqual(isPackageSnapshot(invalid), false);
	});

	it("rejects null", () => {
		assert.strictEqual(isPackageSnapshot(null), false);
	});

	it("rejects undefined", () => {
		assert.strictEqual(isPackageSnapshot(undefined), false);
	});

	it("rejects primitive types", () => {
		assert.strictEqual(isPackageSnapshot("string"), false);
		assert.strictEqual(isPackageSnapshot(123), false);
		assert.strictEqual(isPackageSnapshot(true), false);
	});

	it("accepts empty arrays", () => {
		const valid = {
			$schema:
				"https://raw.githubusercontent.com/earendil-works/pi-mono/v0.11.0/packages/pi-pkg-guard/schema/package-snapshot.json",
			timestamp: "2024-01-15T10:30:00Z",
			npmPackages: [],
		};
		assert.strictEqual(isPackageSnapshot(valid), true);
	});

	it("accepts with excludedPackages", () => {
		const valid = {
			$schema:
				"https://raw.githubusercontent.com/earendil-works/pi-mono/v0.11.0/packages/pi-pkg-guard/schema/package-snapshot.json",
			timestamp: "2024-01-15T10:30:00Z",
			npmPackages: ["pi-foo"],
			excludedPackages: ["pi-bar"],
		};
		assert.strictEqual(isPackageSnapshot(valid), true);
	});

	it("rejects excludedPackages with non-string elements", () => {
		const invalid = {
			$schema:
				"https://raw.githubusercontent.com/earendil-works/pi-mono/v0.11.0/packages/pi-pkg-guard/schema/package-snapshot.json",
			timestamp: "2024-01-15T10:30:00Z",
			npmPackages: ["pi-foo"],
			excludedPackages: [123, "pi-bar"],
		};
		assert.strictEqual(isPackageSnapshot(invalid), false);
	});
});

describe("restore workflow - package filtering", () => {
	it("filters out already registered packages", () => {
		// Simulates: packagesToRestore.filter(pkg => !currentRegistered.has(pkg))
		const currentRegistered = new Set(["pi-foo", "pi-bar"]);
		const packagesToRestore = ["pi-foo", "pi-baz", "pi-qux"];

		const filtered = packagesToRestore.filter(
			(pkg) => !currentRegistered.has(pkg),
		);

		assert.deepStrictEqual(filtered, ["pi-baz", "pi-qux"]);
	});

	it("returns empty array when all packages registered", () => {
		const currentRegistered = new Set(["pi-foo", "pi-bar"]);
		const packagesToRestore = ["pi-foo", "pi-bar"];

		const filtered = packagesToRestore.filter(
			(pkg) => !currentRegistered.has(pkg),
		);

		assert.deepStrictEqual(filtered, []);
	});

	it("returns all packages when none registered", () => {
		const currentRegistered = new Set<string>([]);
		const packagesToRestore = ["pi-foo", "pi-bar"];

		const filtered = packagesToRestore.filter(
			(pkg) => !currentRegistered.has(pkg),
		);

		assert.deepStrictEqual(filtered, ["pi-foo", "pi-bar"]);
	});
});

describe("isValidBackupPath security validation", () => {
	it("accepts path within .pi/agent directory", () => {
		const validPath = join(homedir(), ".pi", "agent", "backup.json");
		assert.strictEqual(isValidBackupPath(validPath), true);
	});

	it("accepts path in tmpdir", () => {
		const validPath = join(tmpdir(), "backup.json");
		assert.strictEqual(isValidBackupPath(validPath), true);
	});

	it("accepts nested path within .pi/agent", () => {
		const validPath = join(
			homedir(),
			".pi",
			"agent",
			"nested",
			"deep",
			"backup.json",
		);
		assert.strictEqual(isValidBackupPath(validPath), true);
	});

	it("rejects path outside allowed directories", () => {
		const invalidPath = join(homedir(), "Documents", "backup.json");
		assert.strictEqual(isValidBackupPath(invalidPath), false);
	});

	it("rejects path with traversal to parent", () => {
		const invalidPath = join(
			homedir(),
			".pi",
			"agent",
			"..",
			"..",
			"backup.json",
		);
		assert.strictEqual(isValidBackupPath(invalidPath), false);
	});

	it("rejects absolute path to home", () => {
		assert.strictEqual(isValidBackupPath(homedir()), false);
	});

	it("rejects system directory paths", () => {
		assert.strictEqual(isValidBackupPath("/etc/passwd"), false);
		assert.strictEqual(isValidBackupPath("/usr/local/bin"), false);
	});
});

/**
 * Backup Migration Tests - Option B: Strict Validation with Migration Path
 *
 * Tests for legacy backup detection and migration functionality.
 */

import assert from "node:assert";
import { describe, it } from "node:test";

// =============================================================================
// Types (mirroring extensions/index.ts)
// =============================================================================

interface PackageSnapshot {
	$schema: string;
	timestamp: string;
	npmPackages: string[];
	excludedPackages?: string[];
}

interface MigrationResult {
	migrated: boolean;
	data?: PackageSnapshot;
	errors?: string[];
}

// =============================================================================
// Migration Implementation (mirroring extensions/index.ts)
// =============================================================================

const EXTENSION_VERSION = "0.11.0";
const PACKAGE_SNAPSHOT_SCHEMA_URL = `https://raw.githubusercontent.com/earendil-works/pi-mono/v${EXTENSION_VERSION}/packages/pi-pkg-guard/schema/package-snapshot.json`;

function isLegacyBackup(data: unknown): boolean {
	if (typeof data !== "object" || data === null) return false;
	if (Array.isArray(data)) return false;

	const candidate = data as Record<string, unknown>;

	// Legacy backup indicators:
	// 1. No $schema field
	// 2. Has timestamp (string)
	// 3. Has npmPackages (array)
	// 4. Has registeredPackages OR unregisteredPackages (old format)

	if (candidate.$schema !== undefined) return false;
	if (typeof candidate.timestamp !== "string") return false;
	if (!Array.isArray(candidate.npmPackages)) return false;

	// Must have at least one of the legacy package arrays
	const hasLegacyFields =
		Array.isArray(candidate.registeredPackages) ||
		Array.isArray(candidate.unregisteredPackages) ||
		Array.isArray(candidate.orphanedPackages);

	return hasLegacyFields;
}

function migrateLegacyBackup(data: unknown): MigrationResult {
	if (!isLegacyBackup(data)) {
		return {
			migrated: false,
			errors: [
				"Not a legacy backup - already has $schema or missing required fields",
			],
		};
	}

	const legacy = data as Record<string, unknown>;

	// Build migrated snapshot - simplified schema only keeps npmPackages
	const migrated: PackageSnapshot = {
		$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
		timestamp: legacy.timestamp as string,
		npmPackages: (legacy.npmPackages as string[]) || [],
	};

	// Optional: preserve excludedPackages if present
	if (Array.isArray(legacy.excludedPackages)) {
		migrated.excludedPackages = legacy.excludedPackages as string[];
	}

	return { migrated: true, data: migrated };
}

// =============================================================================
// Tests
// =============================================================================

describe("isLegacyBackup detection", () => {
	describe("valid legacy backups (should return true)", () => {
		it("detects legacy backup with registeredPackages", () => {
			const legacy = {
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo", "pi-bar"],
				registeredPackages: ["pi-foo"],
				unregisteredPackages: ["pi-bar"],
			};
			assert.strictEqual(isLegacyBackup(legacy), true);
		});

		it("detects legacy backup with orphanedPackages (very old)", () => {
			const legacy = {
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo"],
				registeredPackages: [],
				orphanedPackages: ["pi-bar"], // Old field name
			};
			assert.strictEqual(isLegacyBackup(legacy), true);
		});

		it("detects legacy backup with empty arrays", () => {
			const legacy = {
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
				registeredPackages: [],
				unregisteredPackages: [],
			};
			assert.strictEqual(isLegacyBackup(legacy), true);
		});

		it("detects legacy backup with excludedPackages", () => {
			const legacy = {
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo"],
				registeredPackages: ["pi-foo"],
				unregisteredPackages: [],
				excludedPackages: ["pi-bar"],
			};
			assert.strictEqual(isLegacyBackup(legacy), true);
		});
	});

	describe("non-legacy data (should return false)", () => {
		it("rejects current schema backup (has $schema)", () => {
			const current = {
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo"],
			};
			assert.strictEqual(isLegacyBackup(current), false);
		});

		it("rejects null", () => {
			assert.strictEqual(isLegacyBackup(null), false);
		});

		it("rejects undefined", () => {
			assert.strictEqual(isLegacyBackup(undefined), false);
		});

		it("rejects array", () => {
			assert.strictEqual(isLegacyBackup([]), false);
		});

		it("rejects string", () => {
			assert.strictEqual(isLegacyBackup("backup"), false);
		});

		it("rejects object without timestamp", () => {
			const invalid = {
				npmPackages: ["pi-foo"],
				registeredPackages: ["pi-foo"],
			};
			assert.strictEqual(isLegacyBackup(invalid), false);
		});

		it("rejects object without npmPackages", () => {
			const invalid = {
				timestamp: "2024-01-15T10:30:00Z",
				registeredPackages: ["pi-foo"],
			};
			assert.strictEqual(isLegacyBackup(invalid), false);
		});

		it("rejects object without package arrays", () => {
			const invalid = {
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo"],
			};
			assert.strictEqual(isLegacyBackup(invalid), false);
		});
	});
});

describe("migrateLegacyBackup", () => {
	describe("successful migrations", () => {
		it("migrates legacy backup to simplified schema", () => {
			const legacy = {
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo", "pi-bar"],
				registeredPackages: ["pi-foo"],
				unregisteredPackages: ["pi-bar"],
			};

			const result = migrateLegacyBackup(legacy);

			assert.strictEqual(result.migrated, true);
			assert.ok(result.data);
			assert.strictEqual(result.data?.$schema, PACKAGE_SNAPSHOT_SCHEMA_URL);
			assert.deepStrictEqual(result.data?.npmPackages, ["pi-foo", "pi-bar"]);
			// Simplified schema does not include registeredPackages or unregisteredPackages
			const dataAsRecord = result.data as unknown as Record<string, unknown>;
			assert.strictEqual(dataAsRecord.registeredPackages, undefined);
			assert.strictEqual(dataAsRecord.unregisteredPackages, undefined);
		});

		it("migrates legacy backup with orphanedPackages field", () => {
			const legacy = {
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo", "pi-bar"],
				registeredPackages: ["pi-foo"],
				orphanedPackages: ["pi-bar"], // Old field name
			};

			const result = migrateLegacyBackup(legacy);

			assert.strictEqual(result.migrated, true);
			assert.deepStrictEqual(result.data?.npmPackages, ["pi-foo", "pi-bar"]);
		});

		it("preserves excludedPackages during migration", () => {
			const legacy = {
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo"],
				registeredPackages: ["pi-foo"],
				unregisteredPackages: [],
				excludedPackages: ["pi-excluded"],
			};

			const result = migrateLegacyBackup(legacy);

			assert.strictEqual(result.migrated, true);
			assert.deepStrictEqual(result.data?.excludedPackages, ["pi-excluded"]);
		});

		it("handles empty legacy backup", () => {
			const legacy = {
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
				registeredPackages: [],
				unregisteredPackages: [],
			};

			const result = migrateLegacyBackup(legacy);

			assert.strictEqual(result.migrated, true);
			assert.deepStrictEqual(result.data?.npmPackages, []);
		});
	});

	describe("failed migrations", () => {
		it("rejects non-legacy backup (already has $schema)", () => {
			const current = {
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo"],
			};

			const result = migrateLegacyBackup(current);

			assert.strictEqual(result.migrated, false);
			assert.ok(result.errors);
			assert.ok(result.errors?.length > 0);
		});

		it("rejects null", () => {
			const result = migrateLegacyBackup(null);

			assert.strictEqual(result.migrated, false);
			assert.ok(result.errors);
		});

		it("rejects plain object without legacy fields", () => {
			const invalid = {
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo"],
			};

			const result = migrateLegacyBackup(invalid);

			assert.strictEqual(result.migrated, false);
		});

		it("rejects array", () => {
			const result = migrateLegacyBackup([]);

			assert.strictEqual(result.migrated, false);
		});
	});

	describe("migration roundtrip verification", () => {
		it("produces valid current schema from legacy", () => {
			const legacy = {
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo", "pi-bar", "pi-baz"],
				registeredPackages: ["pi-foo", "pi-bar"],
				unregisteredPackages: ["pi-baz"],
			};

			const result = migrateLegacyBackup(legacy);

			// Verify structure matches current schema
			assert.strictEqual(result.data?.$schema, PACKAGE_SNAPSHOT_SCHEMA_URL);
			assert.strictEqual(typeof result.data?.timestamp, "string");
			assert.ok(Array.isArray(result.data?.npmPackages));
			// No registeredPackages or unregisteredPackages in simplified schema
			const dataAsRecord2 = result.data as unknown as Record<string, unknown>;
			assert.strictEqual(dataAsRecord2.registeredPackages, undefined);
			assert.strictEqual(dataAsRecord2.unregisteredPackages, undefined);
		});

		it("preserves all npmPackages from legacy", () => {
			const legacy = {
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo", "pi-bar", "pi-baz"],
				registeredPackages: ["pi-foo"],
				unregisteredPackages: ["pi-bar", "pi-baz"],
			};

			const result = migrateLegacyBackup(legacy);

			// All npmPackages should be preserved
			assert.deepStrictEqual(result.data?.npmPackages, [
				"pi-foo",
				"pi-bar",
				"pi-baz",
			]);
		});
	});
});

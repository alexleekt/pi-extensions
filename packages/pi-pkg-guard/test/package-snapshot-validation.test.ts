/**
 * Package Snapshot Validation Tests
 *
 * Tests for validatePackageSnapshot function and snapshot schema validation.
 *
 * NOTE: The validatePackageSnapshot implementation is duplicated here rather than
 * imported from extensions/index.ts. This is intentional isolation - importing
 * from the extension would trigger side effects. The test file mirrors the
 * implementation to avoid loading the full extension while testing the validation logic.
 */

import assert from "node:assert";
import { describe, it } from "node:test";

// =============================================================================
// Constants (mirroring extensions/index.ts)
// =============================================================================

const EXTENSION_VERSION = "0.11.0";
const PACKAGE_SNAPSHOT_SCHEMA_URL = `https://raw.githubusercontent.com/earendil-works/pi-mono/v${EXTENSION_VERSION}/packages/pi-pkg-guard/schema/package-snapshot.json`;

// Accept schema URLs from any version tag, main branch, or refs/tags pattern
const ALLOWED_SNAPSHOT_SCHEMA_PATTERNS = [
	PACKAGE_SNAPSHOT_SCHEMA_URL,
	/^https:\/\/raw\.githubusercontent\.com\/earendil-works\/pi-mono\/v\d+\.\d+\.\d+\/packages\/pi-pkg-guard\/schema\/package-snapshot\.json$/,
	/^https:\/\/raw\.githubusercontent\.com\/earendil-works\/pi-mono\/refs\/tags\/v\d+\.\d+\.\d+\/packages\/pi-pkg-guard\/schema\/package-snapshot\.json$/,
	"https://raw.githubusercontent.com/earendil-works/pi-mono/refs/heads/main/packages/pi-pkg-guard/schema/package-snapshot.json",
	"https://raw.githubusercontent.com/earendil-works/pi-mono/main/packages/pi-pkg-guard/schema/package-snapshot.json",
];

// =============================================================================
// Types (mirroring extensions/index.ts)
// =============================================================================

interface ValidationResult {
	valid: boolean;
	errors: string[];
}

// =============================================================================
// Validation Implementation (mirroring extensions/index.ts)
// =============================================================================

function validatePackageSnapshot(data: unknown): ValidationResult {
	const errors: string[] = [];

	// Check if it's an object
	if (typeof data !== "object" || data === null) {
		return { valid: false, errors: ["Data must be an object"] };
	}

	if (Array.isArray(data)) {
		return { valid: false, errors: ["Data must be an object, not an array"] };
	}

	const candidate = data as Record<string, unknown>;

	// Check $schema field
	if (candidate.$schema === undefined) {
		errors.push("Missing required field: $schema");
	} else if (typeof candidate.$schema !== "string") {
		errors.push("Field '$schema' must be a string");
	} else {
		const isValidSchemaUrl = ALLOWED_SNAPSHOT_SCHEMA_PATTERNS.some((pattern) =>
			typeof pattern === "string"
				? candidate.$schema === pattern
				: pattern.test(candidate.$schema as string),
		);
		if (!isValidSchemaUrl) {
			errors.push(
				`Unrecognized schema URL: '${candidate.$schema}'. Expected a pi-pkg-guard package snapshot schema URL.`,
			);
		}
	}

	// Check timestamp
	if (candidate.timestamp === undefined) {
		errors.push("Missing required field: timestamp");
	} else if (typeof candidate.timestamp !== "string") {
		errors.push("Field 'timestamp' must be a string");
	} else if (Number.isNaN(Date.parse(candidate.timestamp))) {
		errors.push("Field 'timestamp' must be a valid ISO 8601 date-time string");
	}

	// Check npmPackages
	if (candidate.npmPackages === undefined) {
		errors.push("Missing required field: npmPackages");
	} else if (!Array.isArray(candidate.npmPackages)) {
		errors.push("Field 'npmPackages' must be an array");
	} else {
		for (let i = 0; i < candidate.npmPackages.length; i++) {
			if (typeof candidate.npmPackages[i] !== "string") {
				errors.push(`Field 'npmPackages[${i}]' must be a string`);
			}
		}
	}

	// Check excludedPackages (optional)
	if (candidate.excludedPackages !== undefined) {
		if (!Array.isArray(candidate.excludedPackages)) {
			errors.push("Field 'excludedPackages' must be an array");
		} else {
			for (let i = 0; i < candidate.excludedPackages.length; i++) {
				if (typeof candidate.excludedPackages[i] !== "string") {
					errors.push(`Field 'excludedPackages[${i}]' must be a string`);
				}
			}
		}
	}

	// Check for additional properties
	const allowedKeys = [
		"$schema",
		"timestamp",
		"npmPackages",
		"excludedPackages",
	];
	for (const key of Object.keys(candidate)) {
		if (!allowedKeys.includes(key)) {
			errors.push(`Unexpected property: '${key}'`);
		}
	}

	return { valid: errors.length === 0, errors };
}

// =============================================================================
// Tests
// =============================================================================

describe("validatePackageSnapshot", () => {
	describe("valid package snapshot (should return valid=true)", () => {
		it("accepts minimal valid snapshot", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: new Date().toISOString(),
				npmPackages: [],
			});
			assert.strictEqual(result.valid, true);
			assert.deepStrictEqual(result.errors, []);
		});

		it("accepts snapshot with packages", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo", "pi-bar"],
			});
			assert.strictEqual(result.valid, true);
		});

		it("accepts snapshot with excludedPackages", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo"],
				excludedPackages: ["pi-bar"],
			});
			assert.strictEqual(result.valid, true);
		});

		it("accepts snapshot with empty arrays", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
				excludedPackages: [],
			});
			assert.strictEqual(result.valid, true);
		});

		it("accepts full-featured snapshot", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["pi-foo", "pi-bar", "pi-baz"],
				excludedPackages: ["pi-qux"],
			});
			assert.strictEqual(result.valid, true);
		});
	});

	describe("invalid type structure (should return valid=false)", () => {
		it("rejects null", () => {
			const result = validatePackageSnapshot(null);
			assert.strictEqual(result.valid, false);
			assert.ok(result.errors.length > 0);
		});

		it("rejects undefined", () => {
			const result = validatePackageSnapshot(undefined);
			assert.strictEqual(result.valid, false);
			assert.ok(result.errors.length > 0);
		});

		it("rejects array", () => {
			const result = validatePackageSnapshot([]);
			assert.strictEqual(result.valid, false);
			assert.ok(result.errors.some((e) => e.includes("not an array")));
		});

		it("rejects string", () => {
			const result = validatePackageSnapshot("not an object");
			assert.strictEqual(result.valid, false);
		});

		it("rejects number", () => {
			const result = validatePackageSnapshot(123);
			assert.strictEqual(result.valid, false);
		});

		it("rejects boolean", () => {
			const result = validatePackageSnapshot(true);
			assert.strictEqual(result.valid, false);
		});
	});

	describe("missing required fields", () => {
		it("rejects missing $schema", () => {
			const result = validatePackageSnapshot({
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
			});
			assert.strictEqual(result.valid, false);
			assert.ok(result.errors.some((e) => e.includes("$schema")));
		});

		it("rejects missing timestamp", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				npmPackages: [],
			});
			assert.strictEqual(result.valid, false);
			assert.ok(result.errors.some((e) => e.includes("timestamp")));
		});

		it("rejects missing npmPackages", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
			});
			assert.strictEqual(result.valid, false);
			assert.ok(result.errors.some((e) => e.includes("npmPackages")));
		});

		it("reports all missing fields at once", () => {
			const result = validatePackageSnapshot({});
			assert.strictEqual(result.valid, false);
			assert.ok(result.errors.some((e) => e.includes("$schema")));
			assert.ok(result.errors.some((e) => e.includes("timestamp")));
			assert.ok(result.errors.some((e) => e.includes("npmPackages")));
		});
	});

	describe("schema URL validation", () => {
		it("accepts current version URL", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
			});
			assert.strictEqual(result.valid, true);
		});

		it("accepts different version tag URL", () => {
			const result = validatePackageSnapshot({
				$schema:
					"https://raw.githubusercontent.com/earendil-works/pi-mono/v0.8.0/packages/pi-pkg-guard/schema/package-snapshot.json",
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
			});
			assert.strictEqual(result.valid, true);
		});

		it("accepts refs/tags pattern URL", () => {
			const result = validatePackageSnapshot({
				$schema:
					"https://raw.githubusercontent.com/earendil-works/pi-mono/refs/tags/v0.8.0/packages/pi-pkg-guard/schema/package-snapshot.json",
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
			});
			assert.strictEqual(result.valid, true);
		});

		it("accepts main branch URL", () => {
			const result = validatePackageSnapshot({
				$schema:
					"https://raw.githubusercontent.com/earendil-works/pi-mono/main/packages/pi-pkg-guard/schema/package-snapshot.json",
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
			});
			assert.strictEqual(result.valid, true);
		});

		it("rejects invalid schema URL", () => {
			const result = validatePackageSnapshot({
				$schema: "https://example.com/evil-schema.json",
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
			});
			assert.strictEqual(result.valid, false);
			assert.ok(
				result.errors.some((e) => e.includes("Unrecognized schema URL")),
			);
		});

		it("rejects non-string $schema", () => {
			const result = validatePackageSnapshot({
				$schema: 123,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
			});
			assert.strictEqual(result.valid, false);
			assert.ok(
				result.errors.some(
					(e) => e.includes("$schema") && e.includes("string"),
				),
			);
		});
	});

	describe("timestamp validation", () => {
		it("rejects non-string timestamp", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: 12345,
				npmPackages: [],
			});
			assert.strictEqual(result.valid, false);
			assert.ok(
				result.errors.some(
					(e) => e.includes("timestamp") && e.includes("string"),
				),
			);
		});

		it("rejects invalid date string", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "not-a-valid-date",
				npmPackages: [],
			});
			assert.strictEqual(result.valid, false);
			assert.ok(result.errors.some((e) => e.includes("ISO 8601")));
		});

		it("accepts valid ISO 8601 strings", () => {
			const timestamps = [
				"2024-01-15T10:30:00Z",
				"2024-01-15T10:30:00.000Z",
				"2024-01-15T10:30:00+00:00",
				"2024-01-15",
			];
			for (const timestamp of timestamps) {
				const result = validatePackageSnapshot({
					$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
					timestamp,
					npmPackages: [],
				});
				assert.strictEqual(result.valid, true, `Should accept: ${timestamp}`);
			}
		});
	});

	describe("npmPackages validation", () => {
		it("rejects non-array npmPackages", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: "not-an-array",
			});
			assert.strictEqual(result.valid, false);
			assert.ok(
				result.errors.some(
					(e) => e.includes("npmPackages") && e.includes("array"),
				),
			);
		});

		it("rejects non-string elements in npmPackages", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: ["valid", 123, null],
			});
			assert.strictEqual(result.valid, false);
			assert.ok(
				result.errors.some(
					(e) => e.includes("npmPackages[1]") || e.includes("npmPackages[2]"),
				),
			);
		});
	});

	describe("excludedPackages validation", () => {
		it("rejects non-array excludedPackages", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
				excludedPackages: "not-an-array",
			});
			assert.strictEqual(result.valid, false);
			assert.ok(
				result.errors.some(
					(e) => e.includes("excludedPackages") && e.includes("array"),
				),
			);
		});

		it("rejects non-string elements in excludedPackages", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
				excludedPackages: ["valid", 123],
			});
			assert.strictEqual(result.valid, false);
			assert.ok(result.errors.some((e) => e.includes("excludedPackages[1]")));
		});
	});

	describe("additional properties rejection", () => {
		it("rejects unexpected properties", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
				unexpectedField: "should not be here",
			});
			assert.strictEqual(result.valid, false);
			assert.ok(
				result.errors.some(
					(e) =>
						e.includes("Unexpected property") && e.includes("unexpectedField"),
				),
			);
		});

		it("rejects multiple unexpected properties", () => {
			const result = validatePackageSnapshot({
				$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
				timestamp: "2024-01-15T10:30:00Z",
				npmPackages: [],
				badField1: "value1",
				badField2: "value2",
			});
			assert.strictEqual(result.valid, false);
			assert.ok(result.errors.length >= 2);
		});
	});
});

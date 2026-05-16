/**
 * Gist Utility Tests - Essential Coverage
 *
 * Tests gist ID extraction and validation.
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import {
	extractGistId,
	isValidBackupPath,
	isValidGistId,
} from "../extensions/index.js";

import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

describe("extractGistId", () => {
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
			extractGistId("https://gist.github.com/abc123def45678901234567890123456"),
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

describe("isValidGistId", () => {
	it("accepts valid hex IDs (32+ chars)", () => {
		// Valid 32-character gist IDs
		assert.strictEqual(isValidGistId("abc123def45678901234567890123456"), true);
		assert.strictEqual(isValidGistId("ABC123DEF45678901234567890123456"), true);
		// Longer IDs also valid
		assert.strictEqual(
			isValidGistId("abc123def456789012345678901234567890"),
			true,
		);
	});

	it("rejects short gist IDs (< 32 chars)", () => {
		// Too short - common mistake
		assert.strictEqual(isValidGistId("abc123def456"), false);
		assert.strictEqual(isValidGistId("abc123"), false);
	});

	it("rejects command injection attempts", () => {
		assert.strictEqual(isValidGistId("abc123; rm -rf ~"), false);
		assert.strictEqual(isValidGistId("abc123 && cat /etc/passwd"), false);
	});

	it("rejects empty string", () => {
		assert.strictEqual(isValidGistId(""), false);
	});
});

describe("isValidBackupPath", () => {
	const homeDir = homedir();
	const tmpDir = tmpdir();

	it("accepts paths within .pi/agent", () => {
		const validPath = join(homeDir, ".pi", "agent", "backup.json");
		assert.strictEqual(isValidBackupPath(validPath), true);
	});

	it("accepts paths in tmpdir", () => {
		const validPath = join(tmpDir, "backup.json");
		assert.strictEqual(isValidBackupPath(validPath), true);
	});

	it("rejects paths outside allowed directories", () => {
		assert.strictEqual(isValidBackupPath("/etc/passwd"), false);
		assert.strictEqual(isValidBackupPath("/home/other/user/file.json"), false);
	});

	it("rejects path traversal attempts", () => {
		const agentDir = join(homeDir, ".pi", "agent");
		// Path traversal trying to escape allowed directory
		assert.strictEqual(
			isValidBackupPath(join(agentDir, "..", "..", "etc", "passwd")),
			false,
		);
	});
});

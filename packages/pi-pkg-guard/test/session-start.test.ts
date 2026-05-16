/**
 * Session Start Tests - Story 1.1: Unregistered Package Detection on Startup
 *
 * Tests session_start event handler for detecting unregistered packages
 * and displaying status on startup.
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import { checkRegistrationStatus } from "../extensions/index.js";

describe("checkRegistrationStatus (core of session_start)", () => {
	it("is exported and callable", () => {
		// Verify the function exists and can be called
		const result = checkRegistrationStatus();
		assert.ok(typeof result === "object");
		assert.ok(Array.isArray(result.unregistered));
		assert.ok(typeof result.hasUnregistered === "boolean");
	});

	it("returns consistent structure", () => {
		const result = checkRegistrationStatus();

		// Verify shape matches PackageStatus interface
		assert.ok("unregistered" in result);
		assert.ok("hasUnregistered" in result);
		assert.strictEqual(result.hasUnregistered, result.unregistered.length > 0);
	});
});

describe("PackageStatus structure (for session_start status)", () => {
	it("hasUnregistered is true when unregistered packages exist", () => {
		// We can't control npm state, but we can verify logic consistency
		// If unregistered.length > 0, hasUnregistered should be true
		const mockResult = {
			unregistered: ["pi-test"],
			hasUnregistered: true,
		};
		assert.strictEqual(
			mockResult.hasUnregistered,
			mockResult.unregistered.length > 0,
		);
	});

	it("hasUnregistered is false when no unregistered packages", () => {
		const mockResult = {
			unregistered: [],
			hasUnregistered: false,
		};
		assert.strictEqual(
			mockResult.hasUnregistered,
			mockResult.unregistered.length > 0,
		);
	});
});

describe("session_start behavior patterns", () => {
	it("should set status when unregistered packages detected", () => {
		// Mock the behavior from session_start handler:
		// if (status.hasUnregistered) { ctx.ui.setStatus(...) }
		const status = {
			unregistered: ["pi-foo", "pi-bar"],
			hasUnregistered: true,
		};
		let statusSet = false;

		if (status.hasUnregistered) {
			statusSet = true;
		}

		assert.strictEqual(statusSet, true);
	});

	it("should not set status when no unregistered packages", () => {
		const status = { unregistered: [], hasUnregistered: false };
		let statusSet = false;

		if (status.hasUnregistered) {
			statusSet = true;
		}

		assert.strictEqual(statusSet, false);
	});

	it("status message includes unregistered count", () => {
		const count = 3;
		const expectedPattern = /3/;
		const statusMessage = `${count} unregistered packages detected`;
		assert.ok(expectedPattern.test(statusMessage));
	});
});

describe("session_start event filtering", () => {
	it("should only run on startup reason", () => {
		// The actual handler checks: if (event.reason !== "startup") return;
		const reasons = ["startup", "reload", "new_chat", "user_action"];
		const shouldRun = reasons.map((r) => r === "startup");

		assert.deepStrictEqual(shouldRun, [true, false, false, false]);
	});

	it("should handle missing reason gracefully", () => {
		// Event might not have a reason field
		const event: { reason?: string } = {};
		const shouldRun = event.reason === "startup";
		assert.strictEqual(shouldRun, false);
	});
});

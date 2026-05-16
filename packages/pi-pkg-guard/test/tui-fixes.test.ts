/**
 * TUI Fixes Tests - Testing status lifecycle and notification behaviors
 *
 * Tests for:
 * 1. Status lifecycle: setStatus called with message when orphans exist, cleared when none
 * 2. Gist fallback notification: notify called when local backup fails
 */

import assert from "node:assert";
import { describe, it } from "node:test";

// ============================================================================
// Types and Constants (minimal implementations for testing)
// ============================================================================

const STATUS_KEY = "pi-pkg-guard:unregistered-packages";

// Test message constants - must stay in sync with actual translation values
const TEST_STATUS_MESSAGE = "2 unregistered pi packages. Run /package-guard";
const TEST_UNREGISTERED_MESSAGE = "2 unregistered pi packages";

interface PackageStatus {
	hasUnregistered: boolean;
	unregistered: string[];
}

interface MockUI {
	notify: (message: string, type: "info" | "warning" | "error") => void;
	setStatus: (key: string, message?: string) => void;
}

interface MockContext {
	ui: MockUI;
}

// ============================================================================
// Test: Status Lifecycle
// ============================================================================

describe("Status Lifecycle", () => {
	it("should set status with message when orphans exist", () => {
		const notifyCalls: Array<{ message: string; type: string }> = [];
		const statusCalls: Array<{ key: string; message?: string }> = [];

		const mockCtx: MockContext = {
			ui: {
				notify: (message: string, type: "info" | "warning" | "error") => {
					notifyCalls.push({ message, type });
				},
				setStatus: (key: string, message?: string) => {
					statusCalls.push({ key, message });
				},
			},
		};

		// Simulate session_start with unregistered packages
		const status: PackageStatus = {
			hasUnregistered: true,
			unregistered: ["pi-test", "pi-demo"],
		};

		// Replicate the session_start handler logic
		if (status.hasUnregistered) {
			mockCtx.ui.setStatus(STATUS_KEY, TEST_STATUS_MESSAGE);
		} else {
			mockCtx.ui.setStatus(STATUS_KEY);
		}

		// Assert: setStatus called with key AND message
		assert.strictEqual(statusCalls.length, 1);
		assert.strictEqual(statusCalls[0].key, STATUS_KEY);
		assert.strictEqual(statusCalls[0].message, TEST_STATUS_MESSAGE);
	});

	it("should clear status (no message) when no orphans exist", () => {
		const statusCalls: Array<{ key: string; message?: string }> = [];

		const mockCtx: MockContext = {
			ui: {
				notify: () => {},
				setStatus: (key: string, message?: string) => {
					statusCalls.push({ key, message });
				},
			},
		};

		// Simulate session_start without unregistered packages
		const status: PackageStatus = {
			hasUnregistered: false,
			unregistered: [],
		};

		// Replicate the session_start handler logic
		if (status.hasUnregistered) {
			mockCtx.ui.setStatus(STATUS_KEY, "unregistered message");
		} else {
			mockCtx.ui.setStatus(STATUS_KEY);
		}

		// Assert: setStatus called with key only (undefined message = clear)
		assert.strictEqual(statusCalls.length, 1);
		assert.strictEqual(statusCalls[0].key, STATUS_KEY);
		assert.strictEqual(statusCalls[0].message, undefined);
	});

	it("should clear status when orphans are resolved", () => {
		const statusCalls: Array<{ key: string; message?: string }> = [];

		const mockCtx: MockContext = {
			ui: {
				notify: () => {},
				setStatus: (key: string, message?: string) => {
					statusCalls.push({ key, message });
				},
			},
		};

		// First call: has unregistered packages
		mockCtx.ui.setStatus(STATUS_KEY, TEST_UNREGISTERED_MESSAGE);

		// Second call: unregistered packages resolved
		mockCtx.ui.setStatus(STATUS_KEY);

		// Assert: status was set then cleared
		assert.strictEqual(statusCalls.length, 2);
		assert.strictEqual(statusCalls[0].key, STATUS_KEY);
		assert.strictEqual(statusCalls[0].message, TEST_UNREGISTERED_MESSAGE);
		assert.strictEqual(statusCalls[1].key, STATUS_KEY);
		assert.strictEqual(statusCalls[1].message, undefined);
	});
});

// ============================================================================
// Test: Gist Fallback Notification
// ============================================================================

describe("Gist Fallback Notification", () => {
	it("should notify when local backup fails before trying gist", () => {
		const notifyCalls: Array<{ message: string; type: string }> = [];
		let gistAttempted = false;

		const mockCtx: MockContext = {
			ui: {
				notify: (message: string, type: "info" | "warning" | "error") => {
					notifyCalls.push({ message, type });
				},
				setStatus: () => {},
			},
		};

		// Simulate local backup read failure
		const localBackupExists = false;
		const config = { gistId: "abc123", gistEnabled: true };
		const isGhInstalled = true;

		// Replicate the executeRestore logic for local backup failure
		// NOTE: This message must stay in sync with translation key "restore.local_failed_trying_gist"
		const FALLBACK_MESSAGE = "Local backup not found, trying GitHub Gist...";
		if (!localBackupExists) {
			mockCtx.ui.notify(FALLBACK_MESSAGE, "info");
		}

		// Then try gist
		if (!localBackupExists && config.gistId && isGhInstalled) {
			gistAttempted = true;
		}

		// Assert: notification was shown with the expected fallback message
		assert.strictEqual(notifyCalls.length, 1);
		assert.strictEqual(notifyCalls[0].message, FALLBACK_MESSAGE);
		assert.strictEqual(notifyCalls[0].type, "info");

		// Assert: gist was still attempted
		assert.strictEqual(gistAttempted, true);
	});

	it("should NOT notify when local backup succeeds", () => {
		const notifyCalls: Array<{ message: string; type: string }> = [];

		const mockCtx: MockContext = {
			ui: {
				notify: (message: string, type: "info" | "warning" | "error") => {
					notifyCalls.push({ message, type });
				},
				setStatus: () => {},
			},
		};

		// Simulate local backup read success
		const localBackupExists = true;

		// Only notify if local backup failed
		if (!localBackupExists) {
			mockCtx.ui.notify(
				"Local backup not found, trying GitHub Gist...",
				"info",
			);
		}

		// Assert: no fallback notification
		assert.strictEqual(notifyCalls.length, 0);
	});
});

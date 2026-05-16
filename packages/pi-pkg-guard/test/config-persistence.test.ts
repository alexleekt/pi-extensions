/**
 * Config Persistence Tests
 *
 * Tests that extension settings survive pi-core style rewrites of settings.json
 * by using a dedicated file for extension configuration.
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
	const home = mkdtempSync(join(tmpdir(), "pi-pkg-guard-test-"));
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

describe("extension settings isolation", () => {
	it("reads from dedicated file when present", async () => {
		const home = createTempHome();

		writeFileSync(
			join(home, ".pi", "agent", "pi-pkg-guard.json"),
			JSON.stringify({
				gistId: "abc123def45678901234567890123456",
				gistEnabled: true,
			}),
		);

		const mod = await loadModule(home);
		const config = mod.readExtensionSettings();

		assert.strictEqual(config.gistId, "abc123def45678901234567890123456");
		assert.strictEqual(config.gistEnabled, true);
	});

	it("migrates legacy config from settings.json", async () => {
		const home = createTempHome();

		writeFileSync(
			join(home, ".pi", "agent", "settings.json"),
			JSON.stringify({
				packages: ["npm:pi-foo"],
				"pi-pkg-guard": {
					gistId: "legacy123def456789012345678901234",
					gistEnabled: false,
				},
			}),
		);

		const mod = await loadModule(home);
		const config = mod.readExtensionSettings();

		assert.strictEqual(config.gistId, "legacy123def456789012345678901234");
		assert.strictEqual(config.gistEnabled, false);

		// Verify migration created the dedicated file
		const dedicatedContent = readFileSync(
			join(home, ".pi", "agent", "pi-pkg-guard.json"),
			"utf-8",
		);
		const dedicated = JSON.parse(dedicatedContent);
		assert.strictEqual(dedicated.gistId, "legacy123def456789012345678901234");
	});

	it("survives pi-core style settings.json rewrite", async () => {
		const home = createTempHome();

		writeFileSync(
			join(home, ".pi", "agent", "settings.json"),
			JSON.stringify({
				packages: ["npm:pi-foo"],
				"pi-pkg-guard": {
					gistId: "survivor123def4567890123456789012",
				},
			}),
		);

		const mod = await loadModule(home);

		// First read triggers migration to dedicated file
		mod.readExtensionSettings();

		// Simulate pi core rewriting settings.json without extension key
		writeFileSync(
			join(home, ".pi", "agent", "settings.json"),
			JSON.stringify({ packages: ["npm:pi-bar"] }),
		);

		// Read again — should still have config from dedicated file
		const config = mod.readExtensionSettings();
		assert.strictEqual(config.gistId, "survivor123def4567890123456789012");
	});

	it("writes to dedicated file", async () => {
		const home = createTempHome();

		const mod = await loadModule(home);
		mod.writeExtensionSettings({
			gistId: "newgist123def4567890123456789012",
		});

		const content = readFileSync(
			join(home, ".pi", "agent", "pi-pkg-guard.json"),
			"utf-8",
		);
		const parsed = JSON.parse(content);
		assert.strictEqual(parsed.gistId, "newgist123def4567890123456789012");
	});

	it("dedicated file takes precedence over settings.json", async () => {
		const home = createTempHome();

		// Write different configs to both locations
		writeFileSync(
			join(home, ".pi", "agent", "pi-pkg-guard.json"),
			JSON.stringify({
				gistId: "dedicated123def4567890123456789012",
			}),
		);
		writeFileSync(
			join(home, ".pi", "agent", "settings.json"),
			JSON.stringify({
				"pi-pkg-guard": {
					gistId: "legacy123def456789012345678901234",
				},
			}),
		);

		const mod = await loadModule(home);
		const config = mod.readExtensionSettings();

		// Dedicated file should win
		assert.strictEqual(config.gistId, "dedicated123def4567890123456789012");
	});

	it("falls back to legacy when dedicated file is empty", async () => {
		const home = createTempHome();

		// Create empty dedicated file (simulates pre-migration state)
		writeFileSync(
			join(home, ".pi", "agent", "pi-pkg-guard.json"),
			JSON.stringify({}),
		);
		writeFileSync(
			join(home, ".pi", "agent", "settings.json"),
			JSON.stringify({
				packages: ["npm:pi-foo"],
				"pi-pkg-guard": {
					gistId: "legacy123def456789012345678901234",
					gistEnabled: true,
				},
			}),
		);

		const mod = await loadModule(home);
		const config = mod.readExtensionSettings();

		// Should recover gist from legacy settings.json and migrate it
		assert.strictEqual(config.gistId, "legacy123def456789012345678901234");
		assert.strictEqual(config.gistEnabled, true);

		// Verify the dedicated file was updated with the migrated config
		const dedicatedContent = readFileSync(
			join(home, ".pi", "agent", "pi-pkg-guard.json"),
			"utf-8",
		);
		const dedicated = JSON.parse(dedicatedContent);
		assert.strictEqual(dedicated.gistId, "legacy123def456789012345678901234");
	});

	it("falls back to empty config when neither file exists", async () => {
		const home = createTempHome();

		const mod = await loadModule(home);
		const config = mod.readExtensionSettings();

		assert.deepStrictEqual(config, {});
	});

	it("creates parent directory when writing to fresh location", async () => {
		const home = createTempHome();

		// Remove the .pi/agent directory to simulate fresh install
		rmSync(join(home, ".pi", "agent"), { recursive: true, force: true });

		const mod = await loadModule(home);
		mod.writeExtensionSettings({
			gistId: "fresh123def456789012345678901234",
		});

		// Should have created the directory and file
		const content = readFileSync(
			join(home, ".pi", "agent", "pi-pkg-guard.json"),
			"utf-8",
		);
		const parsed = JSON.parse(content);
		assert.strictEqual(parsed.gistId, "fresh123def456789012345678901234");
	});
});

// Cleanup all temp homes after tests complete
cleanupTempHomes();

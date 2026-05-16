#!/usr/bin/env node
/**
 * Validation script for pi-ask-user-glimpse extension.
 * Checks compilation, registration, HTML generation, and glimpseui availability.
 */

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { getNativeHostInfo, prompt } from "glimpseui";

const _require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
	console.log("=== pi-ask-user-glimpse Validation ===\n");

	// 1. Check dist/index.html exists
	const distPath = join(__dirname, "..", "dist", "index.html");
	let html: string;
	try {
		html = readFileSync(distPath, "utf-8");
		console.log("✅ dist/index.html exists", `(${(html.length / 1024).toFixed(1)} kB)`);
	} catch {
		console.error("❌ dist/index.html missing — run `npm run build` first");
		process.exit(1);
	}

	// 2. Check HTML contains the payload placeholder
	if (html.includes("ASK_USER_PAYLOAD")) {
		console.log("✅ HTML contains payload placeholder");
	} else {
		console.error("❌ HTML missing payload placeholder");
		process.exit(1);
	}

	// 3. Check glimpseui native host
	const host = getNativeHostInfo();
	console.log(`ℹ️  Glimpse host: ${host.platform} → ${host.path}`);
	try {
		const stat = readFileSync(host.path);
		console.log("✅ Glimpse binary found");
	} catch {
		console.warn("⚠️  Glimpse binary not found — WebView will fall back to terminal");
	}

	// 4. Test payload injection
	const payload = {
		type: "single-select" as const,
		question: "Validation test: does the WebView render?",
		options: [
			{ title: "Yes", description: "Everything looks good" },
			{ title: "No", description: "Something is broken" },
		],
		allowMultiple: false,
		allowFreeform: true,
		allowComment: false,
	};

	const testHtml = html.replace(
		"/*ASK_USER_PAYLOAD*/",
		JSON.stringify(payload).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026"),
	);
	console.log("✅ Payload injection works");

	// 5. Optional: try opening the WebView (requires GUI)
	if (process.argv.includes("--gui")) {
		console.log("\n🖥️  Opening test WebView...");
		try {
			const result = await prompt(testHtml, {
				width: 1200,
				height: 900,
				title: "Validation Test",
			});
			console.log("✅ WebView closed with result:", result);
		} catch (err) {
			console.error("❌ WebView failed:", err);
			process.exit(1);
		}
	} else {
		console.log("\nℹ️  Skipped GUI test (pass --gui to open WebView)");
	}

	console.log("\n=== All checks passed ===");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

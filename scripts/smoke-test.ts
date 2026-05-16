#!/usr/bin/env node
/**
 * Smoke test: opens the WebView for 2 seconds then closes it.
 * Proves the full pipeline (build → payload injection → glimpseui → native window) works.
 */

import { open, getNativeHostInfo } from "glimpseui";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
	const html = readFileSync(join(__dirname, "..", "dist", "index.html"), "utf-8");
	const payload = {
		type: "single-select" as const,
		question: "Smoke test — does the window render correctly?",
		context: "If you see this message with two options, the pipeline works end-to-end.",
		options: [
			{ title: "Looks great", description: "Colors, layout, and search all work" },
			{ title: "Needs work", description: "Something looks off" },
		],
		allowMultiple: false,
		allowFreeform: true,
		allowComment: false,
	};

	const injected = html.replace(
		"/*ASK_USER_PAYLOAD*/",
		JSON.stringify(payload).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026"),
	);

	console.log("Opening WebView for 2 seconds...");
	const host = getNativeHostInfo();
	console.log(`Native host: ${host.platform} → ${host.path}`);

	const win = open(injected, {
		width: 640,
		height: 480,
		title: "pi-ask-user-glimpse smoke test",
	});

	win.on("ready", (info) => {
		console.log("✅ WebView ready", JSON.stringify(info, null, 2).slice(0, 200));
	});

	win.on("message", (data) => {
		console.log("✅ Received message:", data);
		win.close();
	});

	win.on("error", (err) => {
		console.error("❌ WebView error:", err.message);
		process.exit(1);
	});

	// Auto-close after 2 seconds if user doesn't interact
	setTimeout(() => {
		console.log("Auto-closing window...");
		win.close();
	}, 2000);

	win.on("closed", () => {
		console.log("✅ Window closed — smoke test passed");
		process.exit(0);
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

#!/usr/bin/env node
/**
 * Visual QA: opens each prompt type in sequence so you can inspect the UI.
 * Press any key or wait 5 seconds to advance to the next dialog.
 */

import { open } from "glimpseui";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, "..", "dist", "index.html"), "utf-8");

const scenarios = [
	{
		name: "Single Select",
		payload: {
			type: "single-select" as const,
			question: "Which cloud provider should we use?",
			context: "We need managed Kubernetes with good pricing.",
			options: [
				{
					title: "AWS",
					description: "Market leader, broadest service catalog, complex pricing.",
				},
				{
					title: "GCP",
					description: "Strong data/ML stack, good Kubernetes (GKE).",
				},
				{
					title: "Azure",
					description: "Best Windows integration, enterprise discounts.",
				},
				{ title: "Hetzner", description: "Cheap bare metal, EU-centric." },
				{ title: "DigitalOcean", description: "Simple, developer-friendly." },
			],
			allowMultiple: false,
			allowFreeform: true,
			allowComment: true,
		},
	},
	{
		name: "Multi Select",
		payload: {
			type: "multi-select" as const,
			question: "Which features should we implement first?",
			context: "MVP is due in 2 weeks. Pick the most impactful items.",
			options: [
				{ title: "OAuth login", description: "Google + GitHub sign-in" },
				{ title: "Real-time sync", description: "WebSocket live updates" },
				{ title: "Email notifications", description: "Digest + instant alerts" },
				{ title: "Admin dashboard", description: "Analytics and user mgmt" },
				{ title: "API keys", description: "Programmatic access for power users" },
			],
			allowMultiple: true,
			allowFreeform: true,
			allowComment: true,
		},
	},
	{
		name: "Freeform",
		payload: {
			type: "freeform" as const,
			question: "Describe the ideal user onboarding flow.",
			context: "We're redesigning first-time experience. Be specific about steps, copy, and timing.",
			options: [],
			allowMultiple: false,
			allowFreeform: true,
			allowComment: false,
		},
	},
	{
		name: "Questionnaire (freeform)",
		payload: {
			type: "questionnaire" as const,
			question: "Project scoping questionnaire",
			context: "Answer each question to help us scope the project accurately.",
			options: [
				{
					title: "Timeline",
					description: "What's your target launch date?",
				},
				{
					title: "Budget",
					description: "Approximate budget range (USD)",
				},
				{
					title: "Team size",
					description: "How many engineers are available?",
				},
				{
					title: "Existing stack",
					description: "What technologies are you already using?",
				},
			],
			allowMultiple: false,
			allowFreeform: true,
			allowComment: true,
		},
	},
	{
		name: "Questionnaire (per-question multi-choice)",
		payload: {
			type: "questionnaire" as const,
			question: "Architecture questionnaire",
			context: "Select the best options for each architectural decision.",
			options: [],
			questions: [
				{
					title: "Database",
					description: "Pick a primary database",
					options: [
						{ title: "PostgreSQL", description: "Relational, proven" },
						{ title: "MySQL", description: "Widely deployed" },
						{ title: "SQLite", description: "Zero-config" },
					],
					allowMultiple: false,
				},
				{
					title: "Cache layer",
					description: "Select caching strategies",
					options: [
						{ title: "Redis", description: "In-memory key-value" },
						{ title: "Memcached", description: "Simple caching" },
						{ title: "CDN edge", description: "Cache at the edge" },
					],
					allowMultiple: true,
				},
				{
					title: "Deployment target",
					description: "Where will this run?",
					options: [
						{ title: "Kubernetes", description: "Container orchestration" },
						{ title: "Docker Compose", description: "Simple containers" },
						{ title: "Serverless", description: "Functions as a service" },
					],
					allowMultiple: false,
				},
				{
					title: "Notes",
					description: "Any additional context? (freeform)",
				},
			],
			allowMultiple: false,
			allowFreeform: true,
			allowComment: true,
		},
	},
];

function injectPayload(html: string, payload: unknown): string {
	return html.replace(
		"/*ASK_USER_PAYLOAD*/",
		JSON.stringify(payload).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026"),
	);
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function showDialog(name: string, payload: unknown): Promise<void> {
	return new Promise((resolve) => {
		const injected = injectPayload(html, payload);
		const win = open(injected, {
			width: 700,
			height: 500,
			title: `QA: ${name}`,
		});

		let resolved = false;
		const done = () => {
			if (!resolved) {
				resolved = true;
				win.close();
				resolve();
			}
		};

		win.on("ready", () => {
			console.log(`  ✅ ${name} window ready`);
		});

		win.on("message", (data) => {
			console.log(`  📨 ${name} result:`, JSON.stringify(data).slice(0, 100));
			done();
		});

		win.on("closed", () => {
			done();
		});

		win.on("error", (err) => {
			console.error(`  ❌ ${name} error:`, err.message);
			done();
		});

		// Auto-advance after 5 seconds
		setTimeout(done, 5000);
	});
}

async function main() {
	console.log("=== Visual QA: pi-ask-user-glimpse ===\n");
	console.log("Each dialog will open for 5 seconds or until you interact.");
	console.log("Check: colors, layout, search, scroll, buttons, preview pane.\n");

	for (const scenario of scenarios) {
		console.log(`▶️  Opening: ${scenario.name}`);
		await showDialog(scenario.name, scenario.payload);
		await wait(500); // brief pause between windows
	}

	console.log("\n=== Visual QA complete ===");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

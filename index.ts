/**
 * pi-ask-user-glimpse — Pi extension that replaces ask_user with native WebView dialogs via glimpseui.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type, StringEnum } from "@earendil-works/pi-ai";
import { askUserHandler } from "./tool/ask-user.js";
import { detectConflict } from "./util/detect-conflict.js";
import { safe } from "./util/safe-callback.js";

const askUserTool = defineTool({
	name: "ask_user",
	label: "Ask User",
	description:
		"Ask the user a question with optional multiple-choice answers. Use this to gather information interactively. Ask exactly one focused question per call. Before calling, gather context with tools (read/web/ref) and pass a short summary via the context field.",
	promptSnippet:
		"Ask the user one focused question with optional multiple-choice answers to gather information interactively",
	promptGuidelines: [
		"Always use ask_user instead of guessing when user input would improve the answer.",
		"Pass a concise question and, when applicable, a list of options with short titles and optional longer descriptions.",
		"Set allowMultiple: true when more than one choice is valid.",
		"Set allowFreeform: true (default) when the user might want to answer in their own words.",
	],
	parameters: Type.Object({
		question: Type.String({ description: "The question to ask the user" }),
		context: Type.Optional(
			Type.String({
				description: "Additional context to help the user understand the question",
			}),
		),
		options: Type.Optional(
			Type.Array(
				Type.Union([
					Type.String({ description: "Short option label" }),
					Type.Object({
						title: Type.String({ description: "Short title for this option" }),
						description: Type.Optional(
							Type.String({
								description: "Longer description explaining this option",
							}),
						),
					}),
				]),
				{ description: "List of options for the user to choose from" },
			),
		),
		questions: Type.Optional(
			Type.Array(
				Type.Object({
					title: Type.String({ description: "Question title" }),
					description: Type.Optional(Type.String({ description: "Question description" })),
					options: Type.Optional(
						Type.Array(
							Type.Object({
								title: Type.String({ description: "Option title" }),
								description: Type.Optional(Type.String({ description: "Option description" })),
							}),
							{ description: "Options for this question (omit for freeform text)" },
						),
					),
					allowMultiple: Type.Optional(
						Type.Boolean({ description: "Allow multiple selections for this question. Default: false" }),
					),
				},
				{ description: "For questionnaire mode: structured questions with optional multiple-choice options per question" },
				),
			),
		),
		allowMultiple: Type.Optional(
			Type.Boolean({
				description: "Allow selecting multiple options. Default: false",
			}),
		),
		allowFreeform: Type.Optional(
			Type.Boolean({
				description: "Add a freeform text option. Default: true",
			}),
		),
		allowComment: Type.Optional(
			Type.Boolean({
				description:
					"Collect an optional comment after selecting one or more options. Default: false",
			}),
		),
		displayMode: Type.Optional(
			StringEnum(["overlay", "inline"], {
				description: "Legacy option; ignored by Glimpse (always opens a centered dialog)",
			}),
		),
		followCursor: Type.Optional(
			Type.Boolean({
				description: "Make the dialog follow the terminal cursor. Default: false",
			}),
		),
	}),

	async execute(_toolCallId, params, signal, _onUpdate, ctx) {
		return askUserHandler(params, signal, ctx);
	},
});

export default function (pi: ExtensionAPI) {
	pi.registerTool(askUserTool);

	// Defensive: run conflict check inside session_start so the runtime
	// is fully bound. Never use setTimeout/setImmediate in extension factories
	// — unhandled errors in deferred callbacks crash Pi.
	pi.on("session_start", safe("conflict-check", () => detectConflict(pi)));

	pi.registerCommand("ask-debug", {
		description: "Open a debug prompt to test each ask_user dialog type",
		handler: safe("ask-debug-command", async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("ask-debug requires interactive mode", "error");
				return;
			}

			const mode = await ctx.ui.select(
				"Choose a prompt type to test:",
				["single-select", "multi-select", "freeform", "questionnaire"],
			);
			if (!mode) return;

			let params: Parameters<typeof askUserHandler>[0];
			switch (mode) {
				case "single-select":
					params = {
						question: "Test: Single Select",
						context: "Pick one option (with optional freeform and comment)",
						options: [
							{ title: "Option A", description: "Description for A" },
							{ title: "Option B", description: "Description for B" },
							{ title: "Option C", description: "Description for C" },
						],
						allowFreeform: true,
						allowComment: true,
					};
					break;
				case "multi-select":
					params = {
						question: "Test: Multi Select",
						context: "Pick multiple options (with optional freeform and comment)",
						options: [
							{ title: "Feature X", description: "Enable feature X" },
							{ title: "Feature Y", description: "Enable feature Y" },
							{ title: "Feature Z", description: "Enable feature Z" },
						],
						allowMultiple: true,
						allowFreeform: true,
						allowComment: true,
					};
					break;
				case "freeform":
					params = {
						question: "Test: Freeform",
						context: "Type any answer you like",
						allowFreeform: true,
					};
					break;
				case "questionnaire":
					params = {
						question: "Test: Questionnaire",
						context: "Answer multiple structured questions",
						questions: [
							{
								title: "Database",
								description: "Which database should we use?",
								options: [
									{ title: "PostgreSQL", description: "Relational, proven" },
									{ title: "SQLite", description: "Zero-config" },
								],
							},
							{
								title: "Architecture",
								description: "Preferred style?",
								options: [
									{ title: "Monolith", description: "Simple" },
									{ title: "Microservices", description: "Scalable" },
								],
								allowMultiple: true,
							},
							{
								title: "Notes",
								description: "Any additional thoughts?",
							},
						],
						allowComment: true,
					};
					break;
				default:
					return;
			}

			const result = await askUserHandler(params, undefined, ctx);
			const textContent = result.content[0];
			const text = textContent.type === "text" ? textContent.text : "No response";
			ctx.ui.notify(`Result: ${text}`, "info");
		}),
	});
}

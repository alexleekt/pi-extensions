/**
 * pi-ask-user-glimpse — Pi extension that replaces ask_user with native WebView dialogs via glimpseui.
 */

import type { BuildSystemPromptOptions, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type, StringEnum } from "@earendil-works/pi-ai";
import { askUserHandler, type AskUserParams } from "./tool/ask-user.js";

/* ── Generic question-session detection ── */

const QUESTION_SESSION_PATTERNS = [
	/ask the questions? one at a time/i,
	/interview me/i,
	/grilling session/i,
	/ask questions? (one at a time|sequentially|individually)/i,
	/wait for feedback/i,
	/questionnaire mode/i,
	/one question per call/i,
];

const QUESTION_SKILL_NAMES = new Set(["grill-with-docs", "questionnaire", "interview", "grill"]);

const ASK_USER_MANDATE = `
## Tool Usage Mandate — Auto-injected by pi-ask-user-glimpse

When you need to ask the user a question, you MUST use the \`ask_user\`
tool. Do NOT write questions as free-form assistant text. Each question
should be a separate \`ask_user\` tool call.

Rules:
- One question per \`ask_user\` call.
- Provide concise options when the question has discrete choices.
- Set \`allowMultiple: true\` when more than one choice is valid.
- Set \`allowFreeform: true\` when the user might want to answer in their own words.
- Wait for the tool result before continuing to the next question.
`;

function isQuestionSession(systemPrompt: string, options: BuildSystemPromptOptions): boolean {
	const hasQuestionSkill =
		options.skills?.some((s) => QUESTION_SKILL_NAMES.has(s.name.toLowerCase())) ?? false;
	const hasQuestionLanguage = QUESTION_SESSION_PATTERNS.some((p) => p.test(systemPrompt));
	return hasQuestionSkill || hasQuestionLanguage;
}

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

	// ── Auto-detect question sessions and force ask_user usage ──
	pi.on("before_agent_start", async (event, ctx) => {
		const hasAskUser = event.systemPromptOptions.selectedTools?.includes("ask_user");
		if (!hasAskUser) return;

		// Check session-persisted style override
		const entries = ctx.sessionManager.getEntries();
		const styleEntry = entries.find(
			(e) => e.type === "custom" && e.customType === "ask-user-style",
		);
		const styleData = (styleEntry as any)?.data;
		const hasExplicitStyle = styleData && typeof styleData.enabled === "boolean";
		const styleMode = hasExplicitStyle ? styleData.enabled : null;

		const shouldInject =
			styleMode === true ||
			(styleMode === null && isQuestionSession(event.systemPrompt, event.systemPromptOptions));

		if (shouldInject) {
			return { systemPrompt: event.systemPrompt + ASK_USER_MANDATE };
		}
	});

	// ── Manual style toggle for ask_user behavior ──
	pi.registerCommand("ask-style", {
		description: "Cycle ask_user style: Auto → Always Dialog → Plain Text → Auto",
		handler: async (_args, ctx) => {
			const entries = ctx.sessionManager.getEntries();
			const current = entries.find(
				(e) => e.type === "custom" && e.customType === "ask-user-style",
			);
			const data = (current as any)?.data;

			let nextMode: boolean | null;
			let label: string;

			if (!data || typeof data.enabled !== "boolean") {
				nextMode = true;
				label = "Always Dialog (auto-detection overridden)";
			} else if (data.enabled === true) {
				nextMode = false;
				label = "Plain Text (no dialog injection)";
			} else {
				nextMode = null;
				label = "Auto (skill + pattern detection)";
			}

			pi.appendEntry("ask-user-style", { enabled: nextMode });
			ctx.ui.notify(`ask_user style: ${label}`, "info");
		},
	});

	// ── Ask the last assistant message's questions ──
	pi.registerCommand("ask-last", {
		description: "Extract questions from the last assistant message and ask them via ask_user",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				console.warn("[pi-ask-user-glimpse] ask-last requires interactive mode");
				return;
			}

			const entries = ctx.sessionManager.getEntries();
			let lastAssistant: any = null;
			for (let i = entries.length - 1; i >= 0; i--) {
				const e = entries[i] as any;
				if (e.type === "message" && e.message?.role === "assistant") {
					lastAssistant = e;
					break;
				}
			}

			if (!lastAssistant) {
				ctx.ui.notify("No assistant messages found in this session", "warning");
				return;
			}

			const msg: any = lastAssistant.message;
			const content: any = msg.content;

			let fullText = "";
			if (typeof content === "string") {
				fullText = content;
			} else if (Array.isArray(content)) {
				fullText = content
					.filter((c: any) => c.type === "text")
					.map((c: any) => c.text)
					.join("\n");
			}

			if (!fullText.trim()) {
				ctx.ui.notify("Last assistant message has no text content", "warning");
				return;
			}

			const questions = fullText
				.split(/(?<=[.!?])\s+/)
				.map((s: string) => s.trim())
				.filter((s: string) => s.length > 0 && s.endsWith("?"));

			if (questions.length === 0) {
				ctx.ui.notify("No questions found in the last assistant message", "warning");
				return;
			}

			let params: AskUserParams;
			if (questions.length === 1) {
				params = {
					question: questions[0],
					context: fullText,
					allowFreeform: true,
				};
			} else {
				params = {
					question: "The assistant asked multiple questions",
					context: fullText,
					questions: questions.map((q: string) => ({
						title: q.length > 60 ? q.slice(0, 57) + "..." : q,
						description: q,
					})),
					allowComment: true,
				};
			}

			const result = await askUserHandler(params, undefined, ctx);

			// Check if user cancelled
			if ((result.details as any)?.cancelled) {
				ctx.ui.notify("Cancelled — no answer sent", "info");
				return;
			}

			// Send the answer back as a user message so the agent can continue
			const textContent = result.content[0];
			const answer = textContent?.type === "text" ? textContent.text : "";
			if (answer) {
				pi.sendUserMessage(
					`Answering the question${questions.length > 1 ? "s" : ""} from your last message:\n\n${answer}`,
				);
			}
		},
	});

	pi.registerCommand("ask-debug", {
		description: "Open a debug prompt to test each ask_user dialog type",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				console.warn("[pi-ask-user-glimpse] ask-debug requires interactive mode");
				return;
			}

			const mode = await ctx.ui.select(
				"Choose a prompt type to test:",
				["single-select", "multi-select", "freeform", "questionnaire"],
			);
			if (!mode) return;

			let params: AskUserParams;
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
		},
	});
}

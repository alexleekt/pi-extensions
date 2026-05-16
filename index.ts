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
	const hasQuestionSkill = !!options.skills?.some((s) =>
		QUESTION_SKILL_NAMES.has(s.name.toLowerCase()),
	);
	const hasQuestionLanguage = QUESTION_SESSION_PATTERNS.some((p) => p.test(systemPrompt));
	return hasQuestionSkill || hasQuestionLanguage;
}

function getStyleMode(entries: any[]): boolean | null {
	const entry = entries.find((e) => e.type === "custom" && e.customType === "ask-user-style");
	return (entry as any)?.data?.enabled ?? null;
}

function extractTextFromAssistantEntry(entry: any): string {
	const content = entry.message?.content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((c) => c.type === "text")
		.map((c) => c.text)
		.join("\n");
}

/* ── /ask-last: extract questions & implicit requests ── */

const PROTECTED_ABBREVIATIONS = new Set([
	"etc", "vs", "fig", "dr", "mr", "mrs", "ms",
	"prof", "jr", "sr", "inc", "ltd", "corp", "co", "llc", "al",
	"et", "vol", "vols", "pg", "pp", "ch", "chap", "sec", "secs",
]);

function splitSentences(text: string): string[] {
	const PLACEHOLDER = "\x00";

	let buffer = text.replace(
		/\b(e\.g\.|i\.e\.)\b/gi,
		(m) => m.replace(/\./g, PLACEHOLDER),
	);

	buffer = buffer.replace(
		/\b([a-zA-Z]{1,4})\./g,
		(match, abbr) => (PROTECTED_ABBREVIATIONS.has(abbr.toLowerCase()) ? match.replace(".", PLACEHOLDER) : match),
	);

	buffer = buffer.replace(/\d+\.\d+/g, (m) => m.replace(/\./g, PLACEHOLDER));
	buffer = buffer.replace(/https?:\/\/\S+/g, (m) => m.replace(/\./g, PLACEHOLDER));
	buffer = buffer.replace(/\b\w\.\w\./g, (m) => m.replace(/\./g, PLACEHOLDER));

	return buffer
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim().replace(new RegExp(PLACEHOLDER, "g"), "."))
		.filter((s) => s.length > 0);
}

const IMPLICIT_REQUEST_PATTERNS = [
	/\b(let me know|let us know)\b/i,
	/\b(tell me|tell us)\b/i,
	/\b(share your|share any)\b/i,
	/\b(what do you think|what are your thoughts)\b/i,
	/\b(which\b.*\b(would you|do you|should we)\b)/i,
	/\b(should we|can you confirm|please confirm|could you confirm)\b/i,
	/\b(i need your (input|feedback|thoughts|opinion))\b/i,
	/\b(your (thoughts|opinion|preference|feedback))\b/i,
	/\b(please provide|could you provide|can you provide)\b/i,
	/\b(would you like|do you want|do you prefer)\b/i,
];

function hasQuotedQuestion(sentence: string): boolean {
	return /["'`].*\?.*["'`]/.test(sentence) && !sentence.endsWith("?");
}

function looksLikeTernary(sentence: string): boolean {
	return /\?\s*[:;]/.test(sentence) || /=\s*\S+\s*\?/.test(sentence);
}

function extractQuestions(text: string): string[] {
	const explicit: string[] = [];
	const implicit: string[] = [];

	for (const sentence of splitSentences(text)) {
		if (sentence.endsWith("?")) {
			if (hasQuotedQuestion(sentence)) continue;
			if (looksLikeTernary(sentence)) continue;
			if (sentence.length < 10) continue;
			explicit.push(sentence);
			continue;
		}

		if (IMPLICIT_REQUEST_PATTERNS.some((p) => p.test(sentence))) {
			implicit.push(sentence);
		}
	}

	return [...explicit, ...implicit];
}

function truncate(str: string, max: number): string {
	return str.length > max ? str.slice(0, max - 3) + "..." : str;
}

function buildAskLastParams(questions: string[], fullText: string): AskUserParams {
	if (questions.length === 0) {
		return {
			question: "The assistant would like your input on the following:",
			context: fullText,
			allowFreeform: true,
		};
	}
	if (questions.length === 1) {
		return {
			question: questions[0],
			context: fullText,
			allowFreeform: true,
		};
	}
	return {
		question: "The assistant asked multiple questions",
		context: fullText,
		questions: questions.map((q) => ({
			title: truncate(q, 60),
			description: q,
		})),
		allowComment: true,
		allowSkip: true,
	};
}

function buildDebugParams(mode: string): AskUserParams | null {
	switch (mode) {
		case "single-select":
			return {
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
		case "multi-select":
			return {
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
		case "freeform":
			return {
				question: "Test: Freeform",
				context: "Type any answer you like",
				allowFreeform: true,
			};
		case "questionnaire":
			return {
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
		default:
			return null;
	}
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
		allowSkip: Type.Optional(
			Type.Boolean({
				description: "Allow submitting a questionnaire without answering all questions. Default: false",
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

		const styleMode = getStyleMode(ctx.sessionManager.getEntries());
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
			const styleMode = getStyleMode(ctx.sessionManager.getEntries());

			let nextMode: boolean | null;
			let label: string;

			if (styleMode === null) {
				nextMode = true;
				label = "Always Dialog (auto-detection overridden)";
			} else if (styleMode === true) {
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

	pi.registerCommand("ask-last", {
		description: "Extract questions from the last assistant message and ask them via ask_user",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				console.warn("[pi-ask-user-glimpse] ask-last requires interactive mode");
				return;
			}

			const entries = ctx.sessionManager.getEntries();
			const lastAssistant = [...entries]
				.reverse()
				.find((e) => e.type === "message" && (e as any).message?.role === "assistant");

			if (!lastAssistant) {
				ctx.ui.notify("No assistant messages found in this session", "warning");
				return;
			}

			const fullText = extractTextFromAssistantEntry(lastAssistant);
			if (!fullText.trim()) {
				ctx.ui.notify("Last assistant message has no text content", "warning");
				return;
			}

			const questions = extractQuestions(fullText);

			const result = await askUserHandler(buildAskLastParams(questions, fullText), undefined, ctx);

			if ((result.details as any)?.cancelled) {
				ctx.ui.notify("Cancelled — no answer sent", "info");
				return;
			}

			const textContent = result.content[0];
			const answer = textContent?.type === "text" ? textContent.text : "";
			if (!answer) return;

			let prefix: string;
			if (questions.length === 0) {
				prefix = "Responding to your last message:";
			} else {
				const plural = questions.length > 1 ? "s" : "";
				prefix = `Answering the question${plural} from your last message:`;
			}
			pi.sendUserMessage(`${prefix}\n\n${answer}`);
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

			const params = buildDebugParams(mode);
			if (!params) return;

			const result = await askUserHandler(params, undefined, ctx);
			const textContent = result.content[0];
			const text = textContent.type === "text" ? textContent.text : "No response";
			ctx.ui.notify(`Result: ${text}`, "info");
		},
	});
}

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { prompt } from "glimpseui";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { terminalPrompt } from "../fallback/terminal-prompt.js";
import { formatResponse } from "./response-formatter.js";
import type { AskUserPayload, Question } from "../shared/ask-user.js";

const _require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

/** ~100 common English stopwords for title extraction. */
const STOPWORDS = new Set([
	"a","an","the","is","are","was","were","be","been","being",
	"have","has","had","do","does","did","will","would","could","should",
	"may","might","must","shall","can","need","ought","used",
	"to","of","in","for","on","with","at","by","from","as","into",
	"through","during","before","after","above","below","between","under",
	"again","further","then","once","here","there","when","where","why","how",
	"all","each","few","more","most","other","some","such","no","nor","not",
	"only","own","same","so","than","too","very","just","and","but","if","or",
	"because","until","while","which","what","who","whom","this","that",
	"these","those","am","it","its","we","our","you","your","they","their",
	"them","he","him","his","she","her","i","me","my","mine","us",
	"any","both","either","neither","one","two","first","last","another","every",
	"many","much","several",
	"let","new","use","using",
	"make","made","get","got","go","going","want","wanted","like","liked",
	"know","knew","known","think","thought","see","saw","seen","come","came",
	"give","gave","given","take","took","taken","find","found","say","said",
	"tell","told","ask","asked","work","worked","seem","seemed","feel","felt",
	"try","tried","leave","left","call","called","good","well","better","best",
	"bad","worse","worst","old","long","great","little","right","left","big",
	"high","different","important","same","able","next","early","young",
	"public","free","real","easy","clear","recent","local","social","full",
	"small","large","possible","particular","available","special","certain",
	"personal","open","general","enough","probably","actually","especially",
	"finally","usually","perhaps","almost","simply","quickly","recently",
	"already","eventually","suddenly","certainly","definitely","absolutely",
	"completely","totally","entirely","exactly","specifically","particularly",
	"especially","mainly","mostly","partly","fully","nearly","quite","rather",
	"pretty","fairly","really","even","still","yet","ever","never","always",
	"sometimes","often","usually","frequently","rarely","generally",
	"typically","normally","largely","potentially","theoretically",
	"practically","basically","essentially","fundamentally","primarily",
	"chiefly","principally","partially","half","quarter","double","single",
	"multiple","various","hundred","thousand","million","billion",
]);

/** Extract a short title from a question by removing stopwords.
 *  Falls back to first 5 words if nothing meaningful remains.
 */
function summarizeTitle(question: string, maxWords = 3): string {
	const contentWords = question
		.toLowerCase()
		.replace(/[^\w\s]/g, "")
		.split(/\s+/)
		.filter((w) => w.length > 0 && !STOPWORDS.has(w));

	if (contentWords.length === 0) {
		// Nothing but stopwords — fall back to raw truncation
		const words = question.trim().split(/\s+/);
		return words.slice(0, 5).join(" ") + (words.length > 5 ? "…" : "");
	}

	const result = contentWords
		.slice(0, maxWords)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");

	return contentWords.length > maxWords ? result + "…" : result;
}

function resolveWebviewHtml(): string {
	const distPath = join(__dirname, "..", "dist", "index.html");
	try {
		return readFileSync(distPath, "utf-8");
	} catch {
		// Fallback for development: resolve from package root
		const pkgRoot = dirname(_require.resolve("../package.json"));
		const fallbackPath = join(pkgRoot, "dist", "index.html");
		try {
			return readFileSync(fallbackPath, "utf-8");
		} catch (err) {
			throw new Error(
				`Could not find webview bundle. Tried:\n` +
					`  1. ${distPath}\n` +
					`  2. ${fallbackPath}\n` +
					`Run 'npm run build' first to generate dist/index.html.`,
				{ cause: err },
			);
		}
	}
}

export interface AskUserParams {
	question: string;
	context?: string;
	options?: (string | { title: string; description?: string })[];
	questions?: Question[];
	allowMultiple?: boolean;
	allowFreeform?: boolean;
	allowComment?: boolean;
	allowSkip?: boolean;
	displayMode?: string;
	followCursor?: boolean;
}

export async function askUserHandler(
	params: AskUserParams,
	signal: AbortSignal | undefined,
	ctx: ExtensionContext,
) {
	if (signal?.aborted) {
		return {
			content: [{ type: "text" as const, text: "Cancelled" }],
			details: { question: params.question, options: [], response: null, cancelled: true },
		};
	}

	const normalizedOptions = (params.options ?? []).map((opt) => {
		if (typeof opt === "string") return { title: opt };
		return { title: opt.title, description: opt.description };
	});

	const hasOptions = normalizedOptions.length > 0;
	const hasQuestions = params.questions && params.questions.length > 0;
	const allowMultiple = params.allowMultiple ?? false;
	const allowFreeform = params.allowFreeform ?? true;
	const allowComment = params.allowComment ?? false;

	let payloadType: AskUserPayload["type"];
	if (hasQuestions) {
		payloadType = "questionnaire";
	} else if (!hasOptions) {
		payloadType = "freeform";
	} else if (allowMultiple) {
		payloadType = "multi-select";
	} else {
		payloadType = "single-select";
	}

	const payload: AskUserPayload = {
		type: payloadType,
		question: params.question,
		context: params.context,
		options: normalizedOptions,
		questions: params.questions,
		allowMultiple,
		allowFreeform,
		allowComment,
		allowSkip: params.allowSkip,
	};

	let result: Record<string, unknown> | null = null;
	let cancelled = false;
	let error: string | undefined;

	try {
		const baseHtml = resolveWebviewHtml();
		const html = baseHtml.replace(
			"/*ASK_USER_PAYLOAD*/",
			JSON.stringify(payload)
				.replace(/</g, "\\u003c")
				.replace(/>/g, "\\u003e")
				.replace(/&/g, "\\u0026"),
		);

		const options: Record<string, unknown> = {
			width: 1200,
			height: 900,
			title: summarizeTitle(params.question),
		};

		if (params.followCursor) {
			options.followCursor = true;
		}

		result = (await prompt(html, options)) as Record<string, unknown> | null;
		if (result === null || result?.__cancelled === true) {
			cancelled = true;
			result = null;
		}
	} catch (err) {
		// Glimpse unavailable — fall back to terminal prompt
		const fallbackResult = await terminalPrompt(
			payload,
			ctx.hasUI ? ctx.ui : undefined,
		);
		if (fallbackResult === null) {
			cancelled = true;
		} else {
			result = fallbackResult;
		}
		error = err instanceof Error ? err.message : String(err);
	}

	return formatResponse(params.question, normalizedOptions, result, cancelled, error);
}

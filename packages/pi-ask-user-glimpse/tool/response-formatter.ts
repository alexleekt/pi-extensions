import type { AgentToolResult } from "@earendil-works/pi-coding-agent";

export interface AskResponse {
	kind: "selection" | "freeform" | "questionnaire";
	selections?: string[];
	comment?: string;
	text?: string;
	questionnaireDetails?: { question: string; answer: string; kind: "selection" | "freeform"; comment?: string }[];
}

export interface AskToolDetails {
	question: string;
	context?: string;
	options: { title: string; description?: string }[];
	response: AskResponse | null;
	cancelled: boolean;
	error?: string;
}

function normalizeKind(raw: unknown): AskResponse["kind"] {
	if (raw === "freeform" || raw === "questionnaire") return raw;
	return "selection";
}

function buildResponse(result: Record<string, unknown>, kind: AskResponse["kind"]): AskResponse {
	if (kind === "freeform") {
		return { kind, text: String(result.text ?? "").trim() };
	}

	if (kind === "questionnaire") {
		return {
			kind,
			selections: Array.isArray(result.selections) ? result.selections.map(String) : [],
			questionnaireDetails: Array.isArray(result.questionnaireDetails)
				? result.questionnaireDetails.map((d: unknown) => {
						const entry = d as Record<string, unknown>;
						return {
							question: String(entry.question ?? ""),
							answer: String(entry.answer ?? ""),
							kind: entry.kind === "freeform" ? "freeform" : "selection",
							comment: entry.comment ? String(entry.comment) : undefined,
						};
					})
				: [],
		};
	}

	const selections = Array.isArray(result.selections)
		? result.selections.map(String)
		: result.selection
			? [String(result.selection)]
			: [];

	return {
		kind,
		selections,
		comment: result.comment ? String(result.comment) : undefined,
	};
}

function responseToText(response: AskResponse): string {
	if (response.kind === "freeform") {
		return response.text ?? "";
	}
	const selections = response.selections ?? [];
	let text = selections.join(", ");
	if (response.comment) {
		text += `\n\nComment: ${response.comment}`;
	}
	return text;
}

export function formatResponse(
	question: string,
	options: { title: string; description?: string }[],
	result: Record<string, unknown> | null,
	cancelled: boolean,
	error?: string,
): AgentToolResult<AskToolDetails> {
	if (cancelled) {
		return {
			content: [{ type: "text", text: "Cancelled" }],
			details: { question, options, response: null, cancelled: true, error },
		};
	}

	if (!result) {
		return {
			content: [{ type: "text", text: "No response" }],
			details: { question, options, response: null, cancelled: false, error },
		};
	}

	const kind = normalizeKind(result.kind);
	const response = buildResponse(result, kind);
	const text = responseToText(response);

	return {
		content: [{ type: "text", text }],
		details: { question, options, response, cancelled: false, error },
	};
}

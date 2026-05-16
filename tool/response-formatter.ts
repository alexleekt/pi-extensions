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

	const kind =
		result.kind === "freeform"
			? "freeform"
			: result.kind === "questionnaire"
				? "questionnaire"
				: "selection";

	const response: AskResponse =
		kind === "freeform"
			? { kind, text: String(result.text ?? "") }
			: kind === "questionnaire"
				? {
						kind,
						selections: Array.isArray(result.selections)
							? result.selections.map(String)
							: [],
						questionnaireDetails: Array.isArray(result.questionnaireDetails)
							? result.questionnaireDetails.map((d: unknown) => ({
									question: String((d as Record<string, unknown>).question ?? ""),
									answer: String((d as Record<string, unknown>).answer ?? ""),
									kind:
										(d as Record<string, unknown>).kind === "freeform"
											? "freeform"
											: "selection",
									comment: (d as Record<string, unknown>).comment
										? String((d as Record<string, unknown>).comment)
										: undefined,
								}))
							: [],
					}
				: {
						kind,
						selections: Array.isArray(result.selections)
							? result.selections.map(String)
							: [String(result.selection ?? "")],
						comment: result.comment ? String(result.comment) : undefined,
					};

	let text: string;
	if (kind === "freeform") {
		text = response.text ?? "";
	} else {
		const selections = response.selections ?? [];
		text = selections.join(", ");
		if (response.comment) {
			text += `\n\nComment: ${response.comment}`;
		}
	}

	return {
		content: [{ type: "text", text }],
		details: { question, options, response, cancelled: false, error },
	};
}

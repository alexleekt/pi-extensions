/**
 * Shared types between the server-side payload construction
 * (tool/ask-user.ts) and the webview React app (webview/src/).
 *
 * Keep this file free of runtime dependencies so both NodeNext
 * and bundler moduleResolution can consume it cleanly.
 */

export interface QuestionOption {
	title: string;
	description?: string;
}

export interface Question {
	title: string;
	description?: string;
	options?: QuestionOption[];
	allowMultiple?: boolean;
}

export interface AskUserPayload {
	type: "single-select" | "multi-select" | "questionnaire" | "freeform";
	question: string;
	context?: string;
	options: QuestionOption[];
	questions?: Question[];
	allowMultiple: boolean;
	allowFreeform: boolean;
	allowComment: boolean;
	allowSkip?: boolean;
}

export interface QuestionnaireDetail {
	question: string;
	answer: string;
	kind: "selection" | "freeform";
	comment?: string;
}

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
    recommended?: boolean;
}

export interface Question {
    title: string;
    description?: string;
    options?: QuestionOption[];
    allowMultiple?: boolean;
}

export type ThemeMode = "light" | "dark" | "system";
export type AnimationLevel = "none" | "minimal" | "all";

export interface AskUserPayload {
    type: "single-select" | "multi-select" | "questionnaire" | "freeform";
    question: string;
    context?: string;
    contextFormat?: "markdown" | "html";
    options: QuestionOption[];
    questions?: Question[];
    allowMultiple: boolean;
    allowFreeform: boolean;
    allowComment: boolean;
    allowSkip?: boolean;
    sessionName?: string;
    theme?: ThemeMode;
    animationLevel?: AnimationLevel;
}

export interface QuestionnaireDetail {
    question: string;
    answer: string;
    kind: "selection" | "freeform";
    comment?: string;
}

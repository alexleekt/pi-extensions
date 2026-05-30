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

/** Named theme identifiers (all available variants) */
export type ThemeName = string;

export const ALL_THEME_NAMES: ThemeName[] = [
    "light",
    "dark",
    "nord-dark",
    "nord-light",
    "tokyo-night",
    "tokyo-night-storm",
    "tokyo-night-light",
    "catppuccin-latte",
    "catppuccin-frappe",
    "catppuccin-macchiato",
    "catppuccin-mocha",
    "dracula",
    "dracula-light",
    "one-dark",
    "one-light",
    "ayu-dark",
    "ayu-light",
    "github-dark",
    "github-light",
    "night-owl",
    "night-owl-light",
    "houston",
    "houston-light",
];

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
    theme?: ThemeName;
    mode?: ThemeMode;
    animationLevel?: AnimationLevel;
}

export interface QuestionnaireDetail {
    question: string;
    answer: string;
    kind: "selection" | "freeform";
    comment?: string;
}

/** Sentinel title used for the freeform "not listed" option in select dialogs. */
export const FREEFORM_OPTION_TITLE = "My answer isn't listed above";

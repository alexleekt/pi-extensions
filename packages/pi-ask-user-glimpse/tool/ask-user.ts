import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { prompt } from "glimpseui";
import type {
    AnimationLevel,
    AskUserPayload,
    Question,
    ThemeMode,
} from "../shared/ask-user.js";
import { formatResponse } from "./response-formatter.js";

const _require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

import { STOPWORDS } from "../constants/stopwords.js";

/** Warn once per process when Glimpse is unavailable. */
let _warnedGlimpseUnavailable = false;

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

    return contentWords.length > maxWords ? `${result}…` : result;
}

function resolveWebviewHtml(): string {
    const distPath = join(__dirname, "..", "dist", "index.html");
    console.log(`[pi-ask-user-glimpse] Loading webview from: ${distPath}`);
    try {
        return readFileSync(distPath, "utf-8");
    } catch {
        // Fallback for development: resolve from package root
        const pkgRoot = dirname(_require.resolve("../package.json"));
        const fallbackPath = join(pkgRoot, "dist", "index.html");
        console.log(`[pi-ask-user-glimpse] Fallback: ${fallbackPath}`);
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
    contextFormat?: "markdown" | "html";
    options?: (
        | string
        | { title: string; description?: string; recommended?: boolean }
    )[];
    questions?: Question[];
    allowMultiple?: boolean;
    allowFreeform?: boolean;
    allowComment?: boolean;
    allowSkip?: boolean;
    displayMode?: string;
    followCursor?: boolean;
    theme?: ThemeMode;
    animationLevel?: AnimationLevel;
}

export interface AskUserMetadata {
    theme?: string;
    animationLevel?: string;
}

export async function askUserHandler(
    params: AskUserParams,
    signal: AbortSignal | undefined,
    ctx: ExtensionContext,
    onMetadata?: (metadata: AskUserMetadata) => void,
) {
    if (signal?.aborted) {
        return {
            content: [{ type: "text" as const, text: "Cancelled" }],
            details: {
                question: params.question,
                options: [],
                response: null,
                cancelled: true,
            },
        };
    }

    const normalizedOptions = (params.options ?? []).map((opt) => {
        if (typeof opt === "string") return { title: opt };
        return {
            title: opt.title,
            description: opt.description,
            recommended: opt.recommended,
        };
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

    // If the question is long and no separate context was provided, auto-split
    // the first sentence into the question and the rest into context.
    let question = params.question;
    let context = params.context;
    if (!context && params.question.length > 120) {
        const match = params.question.match(/^(.+?[.?!])(\s+|$)/);
        if (match && match[0].length < params.question.length) {
            question = match[1].trim();
            context = params.question.slice(match[0].length).trim();
        }
    }

    const payload: AskUserPayload = {
        type: payloadType,
        question,
        context,
        contextFormat: params.contextFormat,
        options: normalizedOptions,
        questions: params.questions,
        allowMultiple,
        allowFreeform,
        allowComment,
        allowSkip: params.allowSkip,
        sessionName: ctx.sessionManager.getSessionName(),
        theme: params.theme,
        animationLevel: params.animationLevel,
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

        const sessionName = ctx.sessionManager.getSessionName();
        const questionTitle = summarizeTitle(params.question);
        const title = sessionName
            ? `Pi · ${sessionName} · ${questionTitle}`
            : `Pi · ${questionTitle}`;

        const windowOptions: Record<string, unknown> = {
            width: 1200,
            height: 900,
            title: title.length > 60 ? `${title.slice(0, 57)}…` : title,
        };

        if (params.followCursor) {
            windowOptions.followCursor = true;
        }

        result = (await prompt(html, { ...windowOptions, timeout: 120000 })) as Record<
            string,
            unknown
        > | null;
        if (result === null || result?.__cancelled === true) {
            cancelled = true;
            result = null;
        } else if (result && onMetadata) {
            onMetadata({
                theme: result.__theme as string | undefined,
                animationLevel: result.__animationLevel as string | undefined,
            });
        }
    } catch (_err) {
        // Glimpse unavailable — fast-exit and warn once
        if (!_warnedGlimpseUnavailable) {
            _warnedGlimpseUnavailable = true;
            console.warn(
                "[pi-ask-user-glimpse] Glimpse unavailable — " +
                    "ask_user will return errors. " +
                    "Install glimpseui or run in a UI-enabled environment.",
            );
        }
        return {
            content: [
                {
                    type: "text" as const,
                    text: "No UI available for ask_user dialog. Please ask the user directly in free-form text.",
                },
            ],
            details: {
                question: params.question,
                options: normalizedOptions.map((o) => o.title),
                response: null,
                cancelled: true,
                error: "No UI available",
            },
        };
    }

    return formatResponse(
        params.question,
        normalizedOptions,
        result,
        cancelled,
        error,
    );
}

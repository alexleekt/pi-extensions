import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { prompt } from "glimpseui";
import {
    ALL_THEME_NAMES,
    type AnimationLevel,
    type AskUserPayload,
    type Question,
    type ThemeName,
} from "../shared/ask-user.js";
import { formatResponse } from "./response-formatter.js";

const _require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

import { STOPWORDS } from "../constants/stopwords.js";

/** Warn once per process when Glimpse is unavailable. */
let _warnedGlimpseUnavailable = false;

/** Find the index of the first sentence-end punctuation (`.`, `?`, `!`)
 *  in `text` that is OUTSIDE a fenced code block, followed by whitespace
 *  or end of string. Returns -1 if no such boundary exists.
 *
 *  Used by the auto-split logic so a long question that contains a code
 *  block (e.g. with `1.2.3` version numbers) doesn't get torn at a `.`
 *  inside the code block. We track code-block state by walking the string
 *  and toggling on each ``` marker.
 */
function findFirstSentenceEndOutsideCode(text: string): number {
    let inCode = false;
    let i = 0;
    while (i < text.length) {
        // Toggle code block state on ``` (including info-string fences)
        if (text[i] === "`" && text[i + 1] === "`" && text[i + 2] === "`") {
            inCode = !inCode;
            i += 3;
            // Skip the optional language tag and newline
            while (i < text.length && text[i] !== "\n") i++;
            continue;
        }
        // Inside a code block, skip until the next ``` or end of string
        if (inCode) {
            i++;
            continue;
        }
        // Look for sentence end followed by whitespace or EOS
        if (
            (text[i] === "." || text[i] === "?" || text[i] === "!") &&
            (i + 1 === text.length || /\s/.test(text[i + 1] ?? ""))
        ) {
            return i;
        }
        i++;
    }
    return -1;
}

/** Quick heuristic for "this string contains HTML" — requires at least
 *  one of the tag types we actually render in the HTML context iframe
 *  (div, p, h1-h6, table, ul, ol, li, blockquote, pre, code, span, etc.).
 *  A bare angle-bracket word like `<header>` or `<scenario>` is NOT enough
 *  — markdown headings and angle-bracketed placeholders trip the naive
 *  regex but aren't real HTML.
 */
const HTML_TAG_NAMES = [
    "div",
    "p",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "blockquote",
    "pre",
    "code",
    "strong",
    "em",
    "b",
    "i",
    "a",
    "br",
    "hr",
    "img",
    "section",
    "article",
    "header",
    "footer",
    "main",
    "aside",
    "nav",
    "figure",
    "figcaption",
];
const HTML_TAG_RE = new RegExp(
    `<(${HTML_TAG_NAMES.join("|")})[\\s>/]`,
    "i",
);

function looksLikeHtml(text: string): boolean {
    return HTML_TAG_RE.test(text);
}

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
    followCursor?: boolean;
    theme?: ThemeName;
    animationLevel?: AnimationLevel;
}

export interface AskUserMetadata {
    theme?: ThemeName;
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
    // the first sentence into the question and the rest into context. The
    // boundary is found with a code-block-aware scanner so punctuation
    // inside ``` blocks (e.g. version numbers like 1.2.3) doesn't trigger
    // an early split.
    let question = params.question;
    let context = params.context;
    if (!context && params.question.length > 120) {
        const splitAt = findFirstSentenceEndOutsideCode(params.question);
        if (splitAt > 0 && splitAt < params.question.length - 1) {
            question = params.question.slice(0, splitAt + 1).trim();
            context = params.question.slice(splitAt + 1).trim();
        }
    }

    // If contextFormat is "html" but the content is plain markdown (no tag
    // openers), silently downgrade to markdown so the user sees parsed text
    // instead of raw markdown source in the iframe.
    let contextFormat = params.contextFormat;
    if (contextFormat === "html" && context && !looksLikeHtml(context)) {
        console.warn(
            "[pi-ask-user-glimpse] contextFormat='html' but context has no HTML tags — auto-downgrading to markdown",
        );
        contextFormat = "markdown";
    }

    const payload: AskUserPayload = {
        type: payloadType,
        question,
        context,
        contextFormat,
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

        let aborted = false;
        const onAbort = () => {
            aborted = true;
        };
        signal?.addEventListener("abort", onAbort);

        const rawResult = (await prompt(html, { ...windowOptions })) as unknown;

        signal?.removeEventListener("abort", onAbort);

        if (aborted) {
            return {
                content: [{ type: "text" as const, text: "Cancelled" }],
                details: {
                    question: params.question,
                    options: normalizedOptions,
                    response: null,
                    cancelled: true,
                },
            };
        }

        if (rawResult === null || (typeof rawResult === "object" && rawResult !== null && (rawResult as Record<string, unknown>).__cancelled === true)) {
            cancelled = true;
            result = null;
        } else if (typeof rawResult === "object" && rawResult !== null) {
            result = rawResult as Record<string, unknown>;
            if (onMetadata) {
                onMetadata({
                    theme: ALL_THEME_NAMES.includes(result.__theme as ThemeName) ? result.__theme as ThemeName : undefined,
                    animationLevel: result.__animationLevel as string | undefined,
                });
            }
        } else {
            // Primitive or unexpected return value — treat as no response
            result = null;
            cancelled = false;
        }
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = err instanceof Error ? err.stack : undefined;

        // Timeout = user cancellation, not a tool error
        if (errMsg === "Prompt timed out") {
            return {
                content: [{ type: "text" as const, text: "Cancelled" }],
                details: {
                    question: params.question,
                    options: normalizedOptions,
                    response: null,
                    cancelled: true,
                },
            };
        }

        // Log the actual error so we can diagnose what really failed
        console.error(
            "[pi-ask-user-glimpse] prompt() failed: " + errMsg,
            errStack || "",
        );

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
                options: normalizedOptions,
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
    );
}

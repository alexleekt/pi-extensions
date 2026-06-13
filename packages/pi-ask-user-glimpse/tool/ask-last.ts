import { spawn } from "node:child_process";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { stripThinkingBlocks } from "../shared/preamble.js";
import type { AskUserParams } from "./ask-user.js";

const CLEANUP_TIMEOUT_MS = 8_000;
const MAX_CONTEXT_CHARS = 16_000;
const MAX_QUESTION_CHARS = 240;
const MAX_OPTIONS = 12;
const MAX_QUESTIONS = 12;

interface ExternalCleanupRequest {
    task: "ask-last-cleanup";
    instructions: string;
    assistantMessage: string;
}

const CLEANUP_INSTRUCTIONS = `Convert the assistant message into a single ask_user JSON payload.
Return only JSON. No markdown fences.
Allowed shape:
{
  "question": "short user-facing question",
  "context": "optional markdown context",
  "contextFormat": "markdown",
  "options": [{"title":"...", "description":"optional", "recommended": true}],
  "questions": [{"title":"...", "description":"optional", "options":[...], "allowMultiple": false}],
  "allowMultiple": false,
  "allowFreeform": true,
  "allowComment": false,
  "allowSkip": true
}
Use options only when the assistant clearly presented choices. Use questions for multiple independent asks. If unclear, produce one freeform question with the original message as context.`;

function truncate(str: string, max: number): string {
    return str.length > max ? `${str.slice(0, max - 3)}...` : str;
}

function cleanString(value: unknown, max: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return truncate(trimmed, max);
}

function cleanBoolean(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

function cleanOptions(value: unknown): AskUserParams["options"] | undefined {
    if (!Array.isArray(value)) return undefined;
    const options: NonNullable<AskUserParams["options"]> = [];

    for (const option of value.slice(0, MAX_OPTIONS)) {
        if (typeof option === "string") {
            const title = cleanString(option, 120);
            if (title) options.push({ title });
            continue;
        }
        if (typeof option !== "object" || option === null) {
            continue;
        }
        const record = option as Record<string, unknown>;
        const title = cleanString(record.title, 120);
        if (!title) continue;
        const description = cleanString(record.description, 500);
        const recommended = cleanBoolean(record.recommended);
        options.push({
            title,
            ...(description ? { description } : {}),
            ...(recommended !== undefined ? { recommended } : {}),
        });
    }

    return options.length > 0 ? options : undefined;
}

function cleanQuestions(
    value: unknown,
): AskUserParams["questions"] | undefined {
    if (!Array.isArray(value)) return undefined;
    const questions = value
        .slice(0, MAX_QUESTIONS)
        .map((question) => {
            if (typeof question !== "object" || question === null) {
                return undefined;
            }
            const record = question as Record<string, unknown>;
            const title = cleanString(record.title, 120);
            if (!title) return undefined;
            const description = cleanString(record.description, 500);
            const options = cleanOptions(record.options);
            const allowMultiple = cleanBoolean(record.allowMultiple);
            return {
                title,
                ...(description ? { description } : {}),
                ...(options ? { options } : {}),
                ...(allowMultiple !== undefined ? { allowMultiple } : {}),
            };
        })
        .filter(
            (
                question,
            ): question is NonNullable<AskUserParams["questions"]>[number] =>
                Boolean(question),
        );
    return questions.length > 0 ? questions : undefined;
}

export function buildAskLastFallbackParams(fullText: string): AskUserParams {
    const cleanContext = stripThinkingBlocks(fullText).trim();
    return {
        question: "The assistant would like your input on the following:",
        context: truncate(cleanContext, MAX_CONTEXT_CHARS),
        allowFreeform: true,
    };
}

export function validateAskLastParams(
    value: unknown,
    fullText: string,
): AskUserParams | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null;
    }

    const record = value as Record<string, unknown>;
    const fallback = buildAskLastFallbackParams(fullText);
    const question = cleanString(record.question, MAX_QUESTION_CHARS);
    if (!question) return null;

    const context = cleanString(record.context, MAX_CONTEXT_CHARS);
    const contextFormat =
        record.contextFormat === "html" || record.contextFormat === "markdown"
            ? record.contextFormat
            : undefined;
    const options = cleanOptions(record.options);
    const questions = cleanQuestions(record.questions);
    const allowMultiple = cleanBoolean(record.allowMultiple);
    const allowFreeform = cleanBoolean(record.allowFreeform);
    const allowComment = cleanBoolean(record.allowComment);
    const allowSkip = cleanBoolean(record.allowSkip);

    return {
        question,
        context: context || fallback.context,
        ...(contextFormat ? { contextFormat } : {}),
        ...(questions ? { questions } : {}),
        ...(!questions && options ? { options } : {}),
        ...(allowMultiple !== undefined ? { allowMultiple } : {}),
        allowFreeform: allowFreeform ?? true,
        ...(allowComment !== undefined ? { allowComment } : {}),
        ...(allowSkip !== undefined
            ? { allowSkip }
            : questions
              ? { allowSkip: true }
              : {}),
    };
}

function extractJsonObject(text: string): unknown | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const unwrapped = trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    try {
        return JSON.parse(unwrapped);
    } catch {
        const start = unwrapped.indexOf("{");
        const end = unwrapped.lastIndexOf("}");
        if (start === -1 || end <= start) return null;
        try {
            return JSON.parse(unwrapped.slice(start, end + 1));
        } catch {
            return null;
        }
    }
}

async function runExternalCleanupCommand(
    command: string,
    request: ExternalCleanupRequest,
): Promise<unknown | null> {
    return new Promise((resolve) => {
        const child = spawn(command, {
            shell: true,
            stdio: ["pipe", "pipe", "ignore"],
            env: process.env,
        });
        let stdout = "";
        const timer = setTimeout(() => {
            child.kill("SIGTERM");
            resolve(null);
        }, CLEANUP_TIMEOUT_MS);

        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
            stdout += chunk;
        });
        child.on("error", () => {
            clearTimeout(timer);
            resolve(null);
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            if (code !== 0) {
                resolve(null);
                return;
            }
            resolve(extractJsonObject(stdout));
        });
        child.stdin.end(JSON.stringify(request));
    });
}

async function tryExternalCleanup(fullText: string): Promise<unknown | null> {
    const command = process.env.PI_ASK_USER_CLEANUP_COMMAND?.trim();
    if (!command) return null;
    return runExternalCleanupCommand(command, {
        task: "ask-last-cleanup",
        instructions: CLEANUP_INSTRUCTIONS,
        assistantMessage: truncate(
            stripThinkingBlocks(fullText),
            MAX_CONTEXT_CHARS,
        ),
    });
}

async function tryHostAiCleanup(
    _fullText: string,
    _ctx: ExtensionContext,
): Promise<unknown | null> {
    // Pi does not currently document a stable extension-facing structured
    // generation API. Keep this seam explicit so a verified host adapter can
    // be added later without changing /ask's fallback contract.
    return null;
}

export async function buildAskLastParams(
    fullText: string,
    ctx: ExtensionContext,
): Promise<AskUserParams> {
    const hostPayload = await tryHostAiCleanup(fullText, ctx);
    const validHostPayload = validateAskLastParams(hostPayload, fullText);
    if (validHostPayload) return validHostPayload;

    const externalPayload = await tryExternalCleanup(fullText);
    const validExternalPayload = validateAskLastParams(
        externalPayload,
        fullText,
    );
    if (validExternalPayload) return validExternalPayload;

    return buildAskLastFallbackParams(fullText);
}

export function answerPrefix(params: AskUserParams): string {
    if (Array.isArray(params.questions) && params.questions.length > 1) {
        return "Answering the questions from your last message:";
    }
    return "Responding to your last message:";
}

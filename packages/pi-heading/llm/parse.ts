// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { AssistantMessage } from "@earendil-works/pi-ai";

export function extractTextFromMessage(
    msg: AssistantMessage | undefined,
): string {
    if (!msg) return "";

    // Extract raw text from various API shapes.
    // AssistantMessage may be a string union (depending on the upstream type
    // definition), so we keep the string branch as a defensive check even if
    // the primary shape is an object.
    let raw = "";
    if (typeof msg === "string") {
        raw = msg;
    } else if (typeof (msg as { text?: unknown }).text === "string") {
        raw = (msg as { text?: string }).text ?? "";
    } else if (typeof msg.content === "string") {
        raw = msg.content;
    } else if (Array.isArray(msg.content)) {
        const parts: string[] = [];
        for (const part of msg.content) {
            if (!part) continue;
            if (part.type === "text" && typeof part.text === "string")
                parts.push(part.text);
            // thinking/reasoning content is NOT user-facing output — skip it
            else if (typeof part === "string") parts.push(part);
        }
        raw = parts.join("");
    }

    // Parse JSON result field when response_format is json_object
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.result === "string")
                return parsed.result;
        } catch {
            // fall through
        }
    }

    return raw;
}

/** Try to parse a JSON object and extract its `.result` value. Returns undefined on failure. */
export function tryParseJsonResult(text: string): string | undefined {
    try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed.result === "string") return parsed.result;
        if (parsed && parsed.result != null) return String(parsed.result);
    } catch {
        // ignore
    }
    return undefined;
}

/**
 * Regex-based fallback for extracting the value of `"result"` when JSON.parse
 * fails (e.g. trailing text, malformed JSON, extra punctuation).
 * Handles both quoted and unquoted values.
 */
export function extractResultFromJson(text: string): string | undefined {
    // Match {"result": "quoted"} or {"result": unquoted} even with trailing junk
    const match = text.match(
        /^\s*\{\s*"result"\s*:\s*(?:"((?:\\.|[^"\\])*)"|([^,}]*))\s*(?:\}|.*$)/,
    );
    if (!match) return undefined;

    if (match[1] !== undefined) {
        // Quoted string — unescape escaped quotes and newlines
        return match[1].replace(/\\"/g, '"').replace(/\\n/g, " ");
    }
    return match[2].trim();
}

/** Strip common LLM wrapping artifacts (quotes, markdown, extra whitespace, meta prefixes). */
export function cleanLLMOutput(text: string): string {
    return text
        .trim()
        .replace(/^```[a-z]*\n?|\n?```$/g, "") // fences
        .replace(/\n+/g, " ") // newlines → spaces
        .replace(/^["']+|["']+$/g, "") // wrapping quotes (before prefix strip)
        .replace(
            /^\s*(?:The user wants(?: me)? to|The user is|The user has|The user|User wants(?: me)? to|Here is the (?:topic|goal|summary|result|achievement):?)\s*/gi,
            "",
        )
        .replace(/^\s*(?:Topic|Goal|Summary|Achievement|Result):?\s*/i, "")
        .replace(/^["']+|["']+$/g, "") // wrapping quotes (after prefix strip — prefixes may have been hiding quotes)
        .trim();
}

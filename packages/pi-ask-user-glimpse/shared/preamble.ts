/**
 * Agent preamble capture for the ask_user tool.
 *
 * When the agent writes a long plan/analysis as text and then calls
 * `ask_user` with a short question and no explicit `context`, this
 * module extracts the most recent assistant message from the session
 * journal and uses it as background context for the dialog. The user
 * sees the reasoning that led to the question, not just the question
 * itself.
 *
 * This is the long-promised "preamble capture" feature first advertised
 * in v0.5.0 of pi-ask-user-glimpse.
 */

export const MIN_PREAMBLE_LENGTH = 200;
export const MAX_PREAMBLE_LENGTH = 12_000;

/** Strip XML-style `<thinking>` blocks and markdown reasoning blocks. */
export function stripThinkingBlocks(text: string): string {
    return text
        .replace(/<thinking>[\s\S]*?<\/thinking>/g, "")
        .replace(/```\s*thinking\n[\s\S]*?```/g, "")
        .trim();
}

/** Extract plain text from a Pi journal content array. */
function extractTextFromContent(content: unknown): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content
        .filter(
            (c): c is { type: string; text: string } =>
                typeof c === "object" &&
                c !== null &&
                typeof (c as Record<string, unknown>).type === "string" &&
                typeof (c as Record<string, unknown>).text === "string",
        )
        .map((c) => c.text)
        .join("\n");
}

/** Extract plain text from a Pi journal assistant entry. */
export function extractTextFromAssistantEntry(entry: unknown): string {
    if (!entry || typeof entry !== "object") return "";
    const content = (
        (entry as Record<string, unknown>).message as
            | Record<string, unknown>
            | undefined
    )?.content;
    return extractTextFromContent(content);
}

/** Find the most recent assistant entry in the session journal. */
export function findLastAssistantEntry(
    entries: unknown[],
): unknown | undefined {
    return [...entries].reverse().find((e) => {
        if (!e || typeof e !== "object") return false;
        const msg = (e as Record<string, unknown>).message;
        if (!msg || typeof msg !== "object") return false;
        return (msg as Record<string, unknown>).role === "assistant";
    });
}

/** Build a preamble from the most recent assistant journal entry, if it
 *  looks like useful background context (a plan, a summary, an analysis).
 *  Returns an empty string when the preamble should be skipped.
 *
 *  Skips when:
 *  - the entry is missing or has no text
 *  - the cleaned text is below MIN_PREAMBLE_LENGTH
 */
export function buildAgentPreamble(
    entries: unknown[],
    _question: string,
): string {
    const lastAssistant = findLastAssistantEntry(entries);
    if (!lastAssistant) return "";

    const rawText = extractTextFromAssistantEntry(lastAssistant);
    if (!rawText.trim()) return "";

    const cleaned = stripThinkingBlocks(rawText);
    if (cleaned.length < MIN_PREAMBLE_LENGTH) return "";

    if (cleaned.length <= MAX_PREAMBLE_LENGTH) {
        return cleaned;
    }

    // Truncate at a paragraph or sentence boundary to keep the cut clean
    const slice = cleaned.slice(0, MAX_PREAMBLE_LENGTH);
    const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("? "),
    );
    const cutPoint =
        lastBreak > MAX_PREAMBLE_LENGTH * 0.6
            ? lastBreak + 1
            : MAX_PREAMBLE_LENGTH;
    return `${slice.slice(0, cutPoint).trim()}\n\n[…truncated]`;
}

/** Merge an explicit context (passed by the agent) with a captured
 *  preamble (the most recent assistant message), avoiding duplication.
 *
 *  Used by `runAskUserWithTheme` to keep the context panel clean when
 *  the agent or the `/ask` command has already provided a context that
 *  overlaps with the preamble. Without this dedup, the `/ask` command
 *  would render the full assistant text twice (once as the explicit
 *  context, once as the auto-captured preamble).
 *
 *  Returns the final context string ready for the payload:
 *  - empty + empty → ""
 *  - empty + preamble → preamble
 *  - context + empty → context
 *  - context + preamble (distinct) → `${context}\n\n---\n\n${preamble}`
 *  - context + preamble (overlapping) → the longer of the two
 */
export function mergeContextWithPreamble(
    explicitContext: string | undefined,
    preamble: string,
): string {
    const ctx = explicitContext?.trim() ?? "";
    const pre = preamble.trim();
    if (!ctx && !pre) return "";
    if (!ctx) return pre;
    if (!pre) return ctx;

    // Normalize whitespace before dedup checks so trivial reformatting
    // (extra blank lines, trailing newline) doesn't defeat the match.
    const ctxNorm = ctx.replace(/\s+/g, " ").trim();
    const preNorm = pre.replace(/\s+/g, " ").trim();

    if (ctxNorm === preNorm) {
        return ctx;
    }
    if (preNorm.includes(ctxNorm) && ctxNorm.length > 50) {
        // Preamble already contains the explicit context — keep the larger
        return pre;
    }
    if (ctxNorm.includes(preNorm) && preNorm.length > 50) {
        // Explicit context already contains the preamble — keep the larger
        return ctx;
    }

    return `${ctx}\n\n---\n\n${pre}`;
}

/**
 * Shared HTML utilities for the webview.
 */
import { renderMarkdownInline } from "./markdown";

/**
 * Escape HTML special characters to prevent XSS when using
 * `dangerouslySetInnerHTML`.
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Highlight matches of `query` inside `text` with `<mark>` tags.
 * The text is HTML-escaped; the query is used as a plain-text search.
 */
export function highlightMatch(text: string, query: string): string {
    if (!query) return escapeHtml(text);
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${q})`, "gi");

    let lastIndex = 0;
    let result = "";
    let match: RegExpExecArray | null;

    while ((match = re.exec(text)) !== null) {
        result += escapeHtml(text.slice(lastIndex, match.index));
        result += `<mark class="bg-yellow-200 rounded px-0.5" style="background-color:hsl(var(--accent) / 0.2)">${escapeHtml(match[1])}</mark>`;
        lastIndex = re.lastIndex;
    }
    result += escapeHtml(text.slice(lastIndex));
    return result;
}



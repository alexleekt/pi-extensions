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
        result += `<mark class="bg-yellow-200 dark:bg-yellow-700 rounded px-0.5">${escapeHtml(match[1])}</mark>`;
        lastIndex = re.lastIndex;
    }
    result += escapeHtml(text.slice(lastIndex));
    return result;
}

/**
 * Render option title/description text for display.
 *
 * - When no query is provided, renders markdown inline so that bold,
 *   italic, code, and other simple markdown syntax is displayed correctly.
 * - When a query is provided, falls back to HTML-escaped plain text with
 *   search-term highlighting so that highlight markup does not interfere
 *   with markdown parsing.
 */
export function renderOptionText(text: string, query?: string): string {
    if (query) {
        return highlightMatch(text, query);
    }
    return renderMarkdownInline(text);
}

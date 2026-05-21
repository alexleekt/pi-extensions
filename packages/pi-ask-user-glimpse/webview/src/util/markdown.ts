/**
 * Shared markdown rendering utilities for the webview.
 */
import { marked } from "marked";

/**
 * Lightweight sanitizer: strips dangerous tags, event handlers, and
 * malicious URLs. Context comes from the agent; defense in depth
 * against a compromised or confused LLM emitting raw HTML.
 */
export function sanitizeHtml(html: string): string {
    // Block dangerous tags entirely
    const dangerousTags = [
        "script", "style", "iframe", "object", "embed", "form",
        "input", "textarea", "button", "select", "option", "img",
        "svg", "math", "meta", "base", "link", "noscript",
        "template", "portal", "frame", "frameset",
    ];
    for (const tag of dangerousTags) {
        html = html.replace(
            new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"),
            "",
        );
        html = html.replace(
            new RegExp(`<${tag}\\b[^>]*\\/>`, "gi"),
            "",
        );
        html = html.replace(
            new RegExp(`<${tag}\\b[^>]*>`, "gi"),
            "",
        );
    }

    // Strip inline event handlers
    html = html.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
    html = html.replace(/on\w+\s*=\s*[^\s>]+/gi, "");

    // Strip javascript: and data: URLs from href/src/action
    html = html.replace(
        /(href|src|action|formaction)\s*=\s*["']\s*(javascript|data):[^"']*["']/gi,
        '$1=""',
    );
    html = html.replace(
        /(href|src|action|formaction)\s*=\s*[^\s>]+/gi,
        (match) => {
            const lower = match.toLowerCase();
            if (lower.includes("javascript:") || lower.includes("data:")) {
                return 'href=""';
            }
            return match;
        },
    );

    return html;
}

/**
 * Render markdown to sanitized HTML.
 * Optionally pass a custom Marked renderer.
 */
export function renderMarkdown(text: string, renderer?: marked.Renderer): string {
    const raw = marked.parse(text, {
        async: false,
        renderer,
    }) as string;
    return sanitizeHtml(raw);
}

/**
 * Render markdown to sanitized HTML suitable for inline use.
 * Strips the wrapping `<p>` tag that `marked` adds for plain text.
 */
export function renderMarkdownInline(text: string): string {
    const html = renderMarkdown(text);
    // marked wraps inline content in <p>...</p>; strip it for inline contexts
    return html.replace(/^<p>(.*)<\/p>\s*$/s, "$1");
}

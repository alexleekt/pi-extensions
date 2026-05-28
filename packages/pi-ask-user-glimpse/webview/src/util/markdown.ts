/**
 * Shared markdown rendering utilities for the webview.
 */
import { marked } from "marked";
import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
    "b",
    "i",
    "em",
    "strong",
    "a",
    "p",
    "br",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "code",
    "pre",
    "div",
    "span",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "del",
    "sup",
    "sub",
    "details",
    "summary",
];

const ALLOWED_ATTR = [
    "href",
    "target",
    "rel",
    "class",
    "id",
    "title",
    "aria-label",
    "aria-hidden",
    "aria-expanded",
    "role",
    "tabindex",
    // data-* is handled via ALLOWED_ATTR regex in DOMPurify
];

const ALLOWED_PROTOCOLS = /^(?:http|https|mailto|tel):/i;

const SANITIZER_CONFIG: DOMPurify.Config = {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Allow data-* attributes via regex
    ALLOW_DATA_ATTR: true,
    // Strip all inline event handlers
    FORBID_ATTR: [/^on/i],
    // Strip style tags and style attributes
    FORBID_TAGS: ["style"],
    // Keep the DOM intact for non-allowed elements (strip them, don't remove children)
    KEEP_CONTENT: true,
    // Prevent any encoding tricks
    SANITIZE_DOM: true,
};

// Hook: add target="_blank" + rel="noopener noreferrer" to all <a> tags
// and validate href protocols
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
        const href = node.getAttribute("href");
        if (href) {
            // Validate protocol
            if (!ALLOWED_PROTOCOLS.test(href)) {
                node.removeAttribute("href");
            } else {
                node.setAttribute("target", "_blank");
                node.setAttribute("rel", "noopener noreferrer");
            }
        }
    }
});

/**
 * Sanitize raw HTML using DOMPurify with a strict allow-list.
 * Context comes from the agent; defense in depth against a
 * compromised or confused LLM emitting raw HTML.
 */
export function sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, SANITIZER_CONFIG) as string;
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

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
 *
 * For multi-paragraph content (e.g. a question header that contains a
 * short block of explanation), the wrapper `<p>` tags are removed but
 * intermediate ones are preserved so the structure renders correctly.
 *
 * Callers that need strict single-paragraph inline rendering (titles,
 * single-line labels) should pass text without blank lines. Multi-line
 * content is safe to render — it produces valid HTML even when the
 * surrounding container is itself a block element.
 */
export function renderMarkdownInline(text: string): string {
    const html = renderMarkdown(text);
    // For single-paragraph input, marked produces "<p>text</p>\n" — strip
    // the wrapping <p>...</p> and the trailing newline so the inline caller
    // (e.g. a question header) doesn't get a stray <p> wrapper.
    //
    // For multi-block input (multiple `<p>...</p>` blocks, or a paragraph
    // followed by a list/blockquote), keep the raw block-level HTML. The
    // caller is expected to wrap this in a block container (a `<div>` or a
    // flex column item). Stripping the outer wrapper from multi-block
    // output would leave the final element unclosed, producing invalid HTML.
    //
    // Detection: if the source text contains a blank line (markdown
    // paragraph separator) OR marked emitted more than one `</p>`, treat
    // as multi-block and leave the structure intact.
    const hasMultipleBlocks = /\n\s*\n/.test(text) || (html.match(/<\/p>/g) ?? []).length > 1;
    if (hasMultipleBlocks) {
        return html;
    }
    // Single paragraph: strip outer <p>...</p> and trailing whitespace
    return html.replace(/^<p>/, "").replace(/<\/p>\s*$/, "");
}

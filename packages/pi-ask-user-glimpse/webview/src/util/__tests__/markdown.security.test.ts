import { describe, expect, it } from "vitest";
import {
    renderMarkdown,
    renderMarkdownInline,
    sanitizeHtml,
} from "../markdown";

describe("markdown security pipeline", () => {
    describe("sanitizeHtml", () => {
        // ──────────────────────────────────────────────────────────────
        // XSS vector: <script> tags
        // ──────────────────────────────────────────────────────────────
        it("strips <script>alert('xss')</script>", () => {
            const input = "<script>alert('xss')</script>";
            expect(sanitizeHtml(input)).not.toContain("<script>");
            expect(sanitizeHtml(input)).not.toContain("alert('xss')");
        });

        it("strips <script> with type attribute", () => {
            const input = '<script type="text/javascript">alert(1)</script>';
            expect(sanitizeHtml(input)).not.toContain("<script");
            expect(sanitizeHtml(input)).not.toContain("alert(1)");
        });

        // ──────────────────────────────────────────────────────────────
        // XSS vector: <img> with event handlers
        // ──────────────────────────────────────────────────────────────
        it("strips <img src=x onerror=alert('xss')>", () => {
            const input = "<img src=x onerror=alert('xss')>";
            expect(sanitizeHtml(input)).not.toContain("<img");
            expect(sanitizeHtml(input)).not.toContain("onerror");
        });

        // ──────────────────────────────────────────────────────────────
        // XSS vector: event handlers on any tag
        // ──────────────────────────────────────────────────────────────
        it("strips onclick event handlers", () => {
            const input = '<div onclick="alert(\'xss\')">click</div>';
            expect(sanitizeHtml(input)).not.toContain("onclick");
            expect(sanitizeHtml(input)).not.toContain("alert('xss')");
        });

        it("strips onerror event handlers", () => {
            const input = '<div onerror="alert(\'xss\')">text</div>';
            expect(sanitizeHtml(input)).not.toContain("onerror");
        });

        // ──────────────────────────────────────────────────────────────
        // XSS vector: javascript: and data: URLs
        // ──────────────────────────────────────────────────────────────
        it("strips href='javascript:alert(xss)'", () => {
            const input = '<a href="javascript:alert(\'xss\')">click</a>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("javascript:");
            expect(output).toContain("<a");
            expect(output).toContain("</a>");
        });

        it("strips href='data:text/html,<script>alert(1)</script>'", () => {
            const input = '<a href="data:text/html,<script>alert(1)</script>">click</a>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("data:");
            expect(output).toContain("<a");
            expect(output).toContain("</a>");
        });

        // ──────────────────────────────────────────────────────────────
        // XSS vector: combined href + onclick
        // ──────────────────────────────────────────────────────────────
        it("strips both href=javascript: and onclick from same anchor", () => {
            const input = '<a href="javascript:alert(\'xss\')" onclick="alert(\'xss\')">click</a>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("javascript:");
            expect(output).not.toContain("onclick");
            expect(output).not.toContain("alert('xss')");
            expect(output).toContain("<a");
            expect(output).toContain("</a>");
        });

        // ──────────────────────────────────────────────────────────────
        // XSS vector: style attribute with javascript: URL
        // ──────────────────────────────────────────────────────────────
        it("strips style attribute with javascript: URL", () => {
            const input = '<div style="background-image:url(javascript:alert(\'xss\'))">text</div>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("style=");
            expect(output).not.toContain("javascript:");
            expect(output).toContain("text");
        });

        // ──────────────────────────────────────────────────────────────
        // XSS vector: HTML entity encoding bypass
        // ──────────────────────────────────────────────────────────────
        it("strips href with javascript: as HTML entity", () => {
            const input = '<a href="javascript&#58;alert(\'xss\')">click</a>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("javascript:");
            expect(output).not.toContain("&#58;");
            expect(output).not.toContain("alert('xss')");
            expect(output).toContain("<a");
            expect(output).toContain("</a>");
        });

        // ──────────────────────────────────────────────────────────────
        // XSS vector: whitespace padding in javascript:
        // ──────────────────────────────────────────────────────────────
        it("strips href with whitespace-padded javascript:", () => {
            const input = '<a href="javascript: alert(\'xss\')">click</a>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("javascript:");
            expect(output).toContain("<a");
            expect(output).toContain("</a>");
        });

        // ──────────────────────────────────────────────────────────────
        // XSS vector: backtick quotes
        // ──────────────────────────────────────────────────────────────
        it("strips href with backtick quotes", () => {
            const input = '<a href=`javascript:alert(\'xss\')`>click</a>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("javascript:");
            expect(output).toContain("<a");
            expect(output).toContain("</a>");
        });

        // ──────────────────────────────────────────────────────────────
        // XSS vector: <svg> with onload
        // ──────────────────────────────────────────────────────────────
        it("strips <svg onload='alert(xss)'>", () => {
            const input = '<svg onload="alert(\'xss\')">';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("<svg");
            expect(output).not.toContain("onload");
            expect(output).not.toContain("alert('xss')");
        });

        // ──────────────────────────────────────────────────────────────
        // XSS vector: <math> with nested SVG trick
        // ──────────────────────────────────────────────────────────────
        it("strips <math> tag and nested exploit", () => {
            const input = '<math><mtext><table><mglyph><style><img src=x onerror=alert(\'xss\')>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("<math");
            expect(output).not.toContain("<style");
            expect(output).not.toContain("<img");
            expect(output).not.toContain("onerror");
        });

        // ──────────────────────────────────────────────────────────────
        // Safe content: basic formatting tags
        // ──────────────────────────────────────────────────────────────
        it("preserves <b>bold</b>", () => {
            expect(sanitizeHtml("<b>bold</b>")).toContain("<b>bold</b>");
        });

        it("preserves <i>italic</i>", () => {
            expect(sanitizeHtml("<i>italic</i>")).toContain("<i>italic</i>");
        });

        it("preserves <code>code</code>", () => {
            expect(sanitizeHtml("<code>code</code>")).toContain("<code>code</code>");
        });

        // ──────────────────────────────────────────────────────────────
        // Safe content: safe links
        // ──────────────────────────────────────────────────────────────
        it("preserves <a href='https://example.com'>link</a>", () => {
            const input = '<a href="https://example.com">link</a>';
            expect(sanitizeHtml(input)).toContain('href="https://example.com"');
            expect(sanitizeHtml(input)).toContain("<a");
            expect(sanitizeHtml(input)).toContain("</a>");
        });

        it("preserves <a href='mailto:test@example.com'>email</a>", () => {
            const input = '<a href="mailto:test@example.com">email</a>';
            expect(sanitizeHtml(input)).toContain('href="mailto:test@example.com"');
        });

        // ──────────────────────────────────────────────────────────────
        // Safe content: headings, lists, blockquotes
        // ──────────────────────────────────────────────────────────────
        it("preserves <h1> through <h6>", () => {
            expect(sanitizeHtml("<h1>heading</h1>")).toContain("<h1>heading</h1>");
            expect(sanitizeHtml("<h6>heading</h6>")).toContain("<h6>heading</h6>");
        });

        it("preserves <ul> and <li>", () => {
            const input = "<ul><li>item</li></ul>";
            expect(sanitizeHtml(input)).toContain("<ul>");
            expect(sanitizeHtml(input)).toContain("<li>item</li>");
        });

        it("preserves <blockquote>", () => {
            expect(sanitizeHtml("<blockquote>quote</blockquote>")).toContain(
                "<blockquote>quote</blockquote>",
            );
        });

        // ──────────────────────────────────────────────────────────────
        // Regression: nested tags and case-insensitive stripping
        // ──────────────────────────────────────────────────────────────
        it("strips SCRIPT in uppercase", () => {
            const input = "<SCRIPT>alert(1)</SCRIPT>";
            expect(sanitizeHtml(input)).not.toContain("<SCRIPT>");
            expect(sanitizeHtml(input)).not.toContain("alert(1)");
        });

        it("strips <ScRiPt> mixed case", () => {
            const input = "<ScRiPt>alert(1)</ScRiPt>";
            expect(sanitizeHtml(input)).not.toContain("<ScRiPt>");
            expect(sanitizeHtml(input)).not.toContain("alert(1)");
        });

        it("strips self-closing <img />", () => {
            const input = '<img src="x" />';
            expect(sanitizeHtml(input)).not.toContain("<img");
        });

        // ──────────────────────────────────────────────────────────────
        // Regression: forms, inputs, iframes
        // ──────────────────────────────────────────────────────────────
        it("strips <form> tags", () => {
            const input = '<form action="evil.com"><input type="text" /></form>';
            expect(sanitizeHtml(input)).not.toContain("<form");
            expect(sanitizeHtml(input)).not.toContain("<input");
        });

        it("strips <iframe> tags", () => {
            const input = '<iframe src="evil.com"></iframe>';
            expect(sanitizeHtml(input)).not.toContain("<iframe");
        });

        it("strips <object> and <embed> tags", () => {
            const input = '<object data="evil.swf"></object><embed src="evil.swf" />';
            expect(sanitizeHtml(input)).not.toContain("<object");
            expect(sanitizeHtml(input)).not.toContain("<embed");
        });

        // ──────────────────────────────────────────────────────────────
        // Regression: <style> tags (can hide content)
        // ──────────────────────────────────────────────────────────────
        it("strips <style> tags", () => {
            const input = '<style>body { display: none; }</style>';
            expect(sanitizeHtml(input)).not.toContain("<style");
        });

        // ──────────────────────────────────────────────────────────────
        // Regression: <noscript> tags
        // ──────────────────────────────────────────────────────────────
        it("strips <noscript> tags", () => {
            const input = '<noscript><meta http-equiv="refresh" content="0;url=evil.com"></noscript>';
            expect(sanitizeHtml(input)).not.toContain("<noscript");
        });

        // ──────────────────────────────────────────────────────────────
        // Regression: <link> tags (CSS injection)
        // ──────────────────────────────────────────────────────────────
        it("strips <link> tags", () => {
            const input = '<link rel="stylesheet" href="evil.css" />';
            expect(sanitizeHtml(input)).not.toContain("<link");
        });

        // ──────────────────────────────────────────────────────────────
        // Regression: <meta> tags (charset / CSP / refresh injection)
        // ──────────────────────────────────────────────────────────────
        it("strips <meta> tags", () => {
            const input = '<meta http-equiv="refresh" content="0;url=evil.com">';
            expect(sanitizeHtml(input)).not.toContain("<meta");
        });

        // ──────────────────────────────────────────────────────────────
        // DOMPurify-specific: link post-processing
        // ──────────────────────────────────────────────────────────────
        it("adds target='_blank' and rel='noopener noreferrer' to safe links", () => {
            const input = '<a href="https://example.com">link</a>';
            const output = sanitizeHtml(input);
            expect(output).toContain('target="_blank"');
            expect(output).toContain('rel="noopener noreferrer"');
        });

        it("strips ftp: URLs from href", () => {
            const input = '<a href="ftp://evil.com">link</a>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("ftp:");
            expect(output).toContain("<a");
            expect(output).toContain("</a>");
        });

        it("strips blob: URLs from href", () => {
            const input = '<a href="blob:https://example.com/1234">link</a>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("blob:");
            expect(output).toContain("<a");
            expect(output).toContain("</a>");
        });

        it("strips file: URLs from href", () => {
            const input = '<a href="file:///etc/passwd">link</a>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("file:");
            expect(output).toContain("<a");
            expect(output).toContain("</a>");
        });

        it("strips vbscript: URLs from href", () => {
            const input = '<a href="vbscript:msgbox(\'xss\')">link</a>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("vbscript:");
            expect(output).toContain("<a");
            expect(output).toContain("</a>");
        });

        it("strips ping attribute on links", () => {
            const input = '<a href="https://example.com" ping="https://evil.com">click</a>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("ping=");
            expect(output).toContain("href=");
        });

        it("strips formaction attribute on buttons", () => {
            const input = '<button formaction="javascript:alert(1)">click</button>';
            const output = sanitizeHtml(input);
            expect(output).not.toContain("formaction=");
            expect(output).not.toContain("javascript:");
        });
    });

    describe("renderMarkdown", () => {
        // ──────────────────────────────────────────────────────────────
        // Markdown → HTML pipeline: XSS in markdown source
        // ──────────────────────────────────────────────────────────────
        it("sanitizes raw HTML inside markdown", () => {
            const input = "Hello <script>alert('xss')</script> world";
            const output = renderMarkdown(input);
            expect(output).not.toContain("<script>");
            expect(output).toContain("Hello");
            expect(output).toContain("world");
        });

        it("sanitizes raw <img> inside markdown", () => {
            const input = "![alt](x) <img src=x onerror=alert('xss')>";
            const output = renderMarkdown(input);
            // marked HTML-encodes raw HTML tags; DOMPurify strips markdown-generated <img>
            expect(output).not.toContain("<img src=x");
            expect(output).not.toContain("<img src=\"x\"");
            expect(output).toContain("&lt;img");
        });

        it("sanitizes malicious link in markdown", () => {
            const input = "[click](javascript:alert('xss'))";
            const output = renderMarkdown(input);
            expect(output).not.toContain("javascript:");
        });

        it("preserves safe markdown formatting", () => {
            const input = "# Heading\n\n**bold** and *italic*\n\n- list item\n- another item";
            const output = renderMarkdown(input);
            expect(output).toContain("<h1>");
            expect(output).toContain("<strong>");
            expect(output).toContain("<em>");
            expect(output).toContain("<li>");
        });

        it("preserves safe external links in markdown", () => {
            const input = "[link](https://example.com)";
            const output = renderMarkdown(input);
            expect(output).toContain("https://example.com");
            expect(output).toContain("<a");
            expect(output).toContain('target="_blank"');
            expect(output).toContain('rel="noopener noreferrer"');
        });

        // ──────────────────────────────────────────────────────────────
        // Mermaid-specific: code blocks with <script> in labels
        // ──────────────────────────────────────────────────────────────
        it("mermaid code blocks with <script> in labels are escaped", () => {
            const input = '```mermaid\ngraph TD\n  A["<script>alert(1)</script>"]\n```';
            const output = renderMarkdown(input);
            // The markdown renderer produces mermaid divs; the sanitizer runs on the HTML.
            // marked produces `<div class="mermaid">...` with the raw text inside.
            // The sanitizer strips the <script> tag from the label text.
            expect(output).toContain("mermaid");
            expect(output).not.toContain("<script>");
        });
    });

    describe("renderMarkdownInline", () => {
        it("strips inline script and preserves text", () => {
            const input = "text <script>alert(1)</script> more";
            const output = renderMarkdownInline(input);
            expect(output).not.toContain("<script>");
            expect(output).toContain("text");
            expect(output).toContain("more");
        });

        it("strips inline event handlers", () => {
            const input = 'text <span onclick="alert(1)">click</span> more';
            const output = renderMarkdownInline(input);
            expect(output).not.toContain("onclick");
            expect(output).toContain("text");
            expect(output).toContain("more");
        });

        it("preserves safe inline formatting", () => {
            const input = "**bold** and *italic* and `code`";
            const output = renderMarkdownInline(input);
            expect(output).toContain("<strong>");
            expect(output).toContain("<em>");
            expect(output).toContain("<code>");
        });

        it("preserves safe inline links", () => {
            const input = "[link](https://example.com)";
            const output = renderMarkdownInline(input);
            expect(output).toContain("https://example.com");
            expect(output).toContain("<a");
            expect(output).toContain('target="_blank"');
            expect(output).toContain('rel="noopener noreferrer"');
        });

        // ──────────────────────────────────────────────────────────────
        // Multi-paragraph inline: strips the OUTER <p> wrappers but keeps
        // intermediate block structure intact, so the caller (always a
        // block container) gets valid HTML.
        // ──────────────────────────────────────────────────────────────
        it("strips outer <p> for single-paragraph input", () => {
            const output = renderMarkdownInline("Hello world");
            expect(output).toBe("Hello world");
        });

        it("preserves intermediate <p> for multi-paragraph input", () => {
            const input = "First paragraph.\n\nSecond paragraph.";
            const output = renderMarkdownInline(input);
            // For multi-paragraph input we keep the block-level HTML
            // structure intact (each <p>...</p> stays a valid pair).
            // Stripping the outer wrapper would leave the final paragraph
            // unclosed — that's why we no longer attempt it.
            expect(output).toContain("<p>First paragraph.</p>");
            expect(output).toContain("<p>Second paragraph.</p>");
        });

        it("handles paragraph + list combination without broken HTML", () => {
            const input = "Intro paragraph.\n\n- item one\n- item two";
            const output = renderMarkdownInline(input);
            expect(output).toContain("<p>Intro paragraph.</p>");
            expect(output).toContain("<ul>");
            expect(output).toContain("<li>item one</li>");
        });
    });
});

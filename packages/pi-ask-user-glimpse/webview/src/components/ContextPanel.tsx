import { marked } from "marked";
import mermaid from "mermaid";
import { useEffect, useRef } from "react";

interface ContextPanelProps {
    context: string;
}

/**
 * Lightweight sanitizer: strips dangerous tags, event handlers, and
 * malicious URLs. Context comes from the agent; defense in depth
 * against a compromised or confused LLM emitting raw HTML.
 */
function sanitizeHtml(html: string): string {
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

class MermaidRenderer extends marked.Renderer {
    code({ text, lang }: { text: string; lang?: string }) {
        if (lang === "mermaid") {
            return `<div class="mermaid">${text}</div>`;
        }
        return super.code({ text, lang, escaped: false });
    }
}

const mermaidRenderer = new MermaidRenderer();

/** Render markdown with mermaid code blocks converted to <div class="mermaid">. */
function renderMarkdown(text: string): string {
    const raw = marked.parse(text, {
        async: false,
        renderer: mermaidRenderer,
    }) as string;
    return sanitizeHtml(raw);
}

/* ── One-time mermaid init ── */
let _mermaidInitialized = false;
function ensureMermaidInit() {
    if (_mermaidInitialized) return;
    try {
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: "loose",
        });
        _mermaidInitialized = true;
    } catch {
        // ignore init errors — mermaid.run() may still work
    }
}

export default function ContextPanel({ context }: ContextPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const html = renderMarkdown(context);

    useEffect(() => {
        ensureMermaidInit();
        const container = containerRef.current;
        if (!container) return;

        const nodes = container.querySelectorAll<HTMLElement>(".mermaid");
        if (nodes.length === 0) return;

        // Defer to next frame so React has fully committed the DOM.
        const id = requestAnimationFrame(() => {
            mermaid
                .run({ nodes })
                .catch((err: unknown) => {
                    // Log for debugging but don't crash the panel.
                    // eslint-disable-next-line no-console
                    console.warn("[mermaid] render error:", err);
                });
        });

        return () => cancelAnimationFrame(id);
    }, [context]);

    return (
        <div
            ref={containerRef}
            className="markdown-body text-sm"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

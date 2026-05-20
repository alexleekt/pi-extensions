import { marked } from "marked";
import mermaid from "mermaid";
import { useEffect, useRef } from "react";

interface ContextPanelProps {
    context: string;
}

/**
 * Lightweight sanitizer: strips <script> tags and event handlers.
 * Context comes from the agent, but defense in depth against a
 * compromised or confused LLM emitting raw HTML.
 */
function sanitizeHtml(html: string): string {
    return html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<script\b[^>]*\/>/gi, "")
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
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

export default function ContextPanel({ context }: ContextPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const html = renderMarkdown(context);

    useEffect(() => {
        if (!containerRef.current) return;
        mermaid
            .run({ nodes: containerRef.current.querySelectorAll(".mermaid") })
            .catch(() => {
                // Silently ignore mermaid parse errors so broken diagrams
                // don't crash the entire panel.
            });
    }, [context]);

    return (
        <div
            ref={containerRef}
            className="markdown-body text-sm"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

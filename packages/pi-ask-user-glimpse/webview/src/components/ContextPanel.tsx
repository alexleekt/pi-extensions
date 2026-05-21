import mermaid from "mermaid";
import { useEffect, useRef } from "react";
import { marked } from "marked";
import { sanitizeHtml } from "../util/markdown";
import { useSettings } from "../util/settings";

interface ContextPanelProps {
    context: string;
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
function renderContextMarkdown(text: string): string {
    const raw = marked.parse(text, {
        async: false,
        renderer: mermaidRenderer,
    }) as string;
    return sanitizeHtml(raw);
}

/* ── Mermaid theme sync ── */
let _lastMermaidTheme: "default" | "dark" | undefined;

function initMermaid(resolvedTheme: "light" | "dark") {
    const theme = resolvedTheme === "dark" ? "dark" : "default";
    if (_lastMermaidTheme === theme) return;
    try {
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: "loose",
            theme,
        });
        _lastMermaidTheme = theme;
    } catch {
        // ignore init errors — mermaid.run() may still work
    }
}

export default function ContextPanel({ context }: ContextPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useSettings();
    const html = renderContextMarkdown(context);

    useEffect(() => {
        initMermaid(resolvedTheme);
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
    }, [context, resolvedTheme]);

    return (
        <div
            ref={containerRef}
            className="markdown-body text-sm"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

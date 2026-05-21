import mermaid from "mermaid";
import { useEffect, useRef } from "react";
import { marked } from "marked";
import { renderMarkdownInline, sanitizeHtml } from "../util/markdown";
import { useSettings } from "../util/settings";
import { HelpIcon } from "./icons";
import SettingsButton from "./SettingsButton";

interface ContextPanelProps {
    context: string;
    question?: string;
    onShowShortcuts?: () => void;
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

export default function ContextPanel({ context, question, onShowShortcuts }: ContextPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useSettings();
    const html = renderContextMarkdown(context);

    useEffect(() => {
        initMermaid(resolvedTheme);
        const container = containerRef.current;
        if (!container) return;

        const nodes = container.querySelectorAll<HTMLElement>(".mermaid");
        if (nodes.length === 0) return;

        const id = requestAnimationFrame(() => {
            mermaid
                .run({ nodes })
                .catch((err: unknown) => {
                    // eslint-disable-next-line no-console
                    console.warn("[mermaid] render error:", err);
                });
        });

        return () => cancelAnimationFrame(id);
    }, [context, resolvedTheme]);

    return (
        <div className="flex h-full flex-col">
            {question && (
                <div className="shrink-0 border-b border-border bg-card/50">
                    <div className="flex items-start justify-between p-4 gap-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                            <span className="text-muted-foreground text-lg leading-none mt-0.5 select-none" aria-hidden="true">❝</span>
                            <h2
                                className="text-sm font-semibold text-foreground leading-relaxed"
                                dangerouslySetInnerHTML={{
                                    __html: renderMarkdownInline(question),
                                }}
                            />
                        </div>
                        {onShowShortcuts && (
                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                <button
                                    onClick={onShowShortcuts}
                                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                    title="Keyboard shortcuts"
                                >
                                    <HelpIcon />
                                </button>
                                <SettingsButton />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Scrollable markdown context */}
            <div className="flex-1 overflow-y-auto scrollbar-hover">
                <div
                    ref={containerRef}
                    className="markdown-body text-sm p-4"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </div>
        </div>
    );
}

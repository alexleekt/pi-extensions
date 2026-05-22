import { marked } from "marked";
import mermaid from "mermaid";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderMarkdownInline, sanitizeHtml } from "../util/markdown";
import { useSettings } from "../util/settings";
import { HelpIcon } from "./icons";
import SettingsButton from "./SettingsButton";

interface ContextPanelProps {
    context: string;
    contextFormat?: "markdown" | "html";
    question?: string;
    onShowShortcuts?: () => void;
}

const mermaidRenderer = new (class extends marked.Renderer {
    code({ text, lang }: { text: string; lang?: string }) {
        return lang === "mermaid"
            ? `<div class="mermaid">${text}</div>`
            : super.code({ text, lang, escaped: false });
    }
})();

function renderContextMarkdown(text: string): string {
    return sanitizeHtml(
        marked.parse(text, {
            async: false,
            renderer: mermaidRenderer,
        }) as string,
    );
}

let _lastMermaidTheme: "default" | "dark" | undefined;

function initMermaid(theme: "light" | "dark") {
    const mermaidTheme = theme === "dark" ? "dark" : "default";
    if (_lastMermaidTheme === mermaidTheme) return;
    try {
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: "loose",
            theme: mermaidTheme,
        });
        _lastMermaidTheme = mermaidTheme;
    } catch {
        // mermaid.run() may still work despite init failure
    }
}

const IFRAME_CSS_VARS = `
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;
`;

const IFRAME_CSS_VARS_DARK = `
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
    --radius: 0.5rem;
`;

const IFRAME_CSS = `body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
        "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    margin: 0;
    padding: 1rem;
    line-height: 1.6;
    overflow-y: auto;
}`;

const IFRAME_SCRIPT = `window.addEventListener("message", function(e) {
    // Sandbox without allow-same-origin gives this iframe an opaque ("null") origin,
    // so the parent’s origin will never match window.location.origin. We accept any
    // origin because this is a locked-down sandboxed iframe with no network access.
    if (e.data?.type === "theme") {
        document.body.classList.toggle("dark", e.data.theme === "dark");
    }
});`;

function buildIframeSrcdoc(rawHtml: string, theme: "light" | "dark"): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
:root {
${IFRAME_CSS_VARS}
}
.dark {
${IFRAME_CSS_VARS_DARK}
}
${IFRAME_CSS}
</style>
</head>
<body class="${theme}">
${rawHtml}
<script>
${IFRAME_SCRIPT}
</script>
</body>
</html>`;
}

function HtmlContext({
    html,
    resolvedTheme,
}: {
    html: string;
    resolvedTheme: "light" | "dark";
}) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [loaded, setLoaded] = useState(false);
    const srcdoc = useMemo(
        () => buildIframeSrcdoc(html, resolvedTheme),
        [html, resolvedTheme],
    );

    // Send theme message whenever resolvedTheme changes OR when iframe finishes loading.
    // The iframe has an opaque origin (sandbox without allow-same-origin), so we must
    // target "*" for postMessage to be delivered at all.
    useEffect(() => {
        const cw = iframeRef.current?.contentWindow;
        if (!cw || !loaded) return;
        cw.postMessage({ type: "theme", theme: resolvedTheme }, "*");
    }, [resolvedTheme, loaded]);

    return (
        <iframe
            ref={iframeRef}
            loading="lazy"
            sandbox="allow-scripts"
            srcDoc={srcdoc}
            className="h-full w-full border-0"
            title="HTML context"
            onLoad={() => setLoaded(true)}
        />
    );
}

export default function ContextPanel({
    context,
    contextFormat,
    question,
    onShowShortcuts,
}: ContextPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useSettings();
    const html = useMemo(() => renderContextMarkdown(context), [context]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: must re-run when markdown content changes to find mermaid nodes.
    useEffect(() => {
        if (contextFormat === "html") return;
        initMermaid(resolvedTheme);
        const container = containerRef.current;
        if (!container) return;

        const nodes = container.querySelectorAll<HTMLElement>(".mermaid");
        if (nodes.length === 0) return;

        const id = requestAnimationFrame(() => {
            mermaid.run({ nodes }).catch((err: unknown) => {
                // eslint-disable-next-line no-console
                console.warn("[mermaid] render error:", err);
            });
        });

        return () => cancelAnimationFrame(id);
    }, [context, resolvedTheme, contextFormat]);

    return (
        <div className="flex h-full flex-col">
            {question && (
                <div className="shrink-0 border-b border-border bg-card/50">
                    <div className="flex items-start justify-between p-4 gap-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                            <span
                                className="text-muted-foreground text-sm leading-none mt-1 select-none"
                                aria-hidden="true"
                            >
                                ❝
                            </span>
                            <h2
                                className="text-base font-semibold text-foreground leading-relaxed"
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

            {/* Scrollable context: markdown or HTML iframe */}
            <div className="flex-1 overflow-y-auto scrollbar-hover">
                {contextFormat === "html" ? (
                    <HtmlContext html={context} resolvedTheme={resolvedTheme} />
                ) : (
                    <div
                        ref={containerRef}
                        className="markdown-body text-sm p-4"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                )}
            </div>
        </div>
    );
}

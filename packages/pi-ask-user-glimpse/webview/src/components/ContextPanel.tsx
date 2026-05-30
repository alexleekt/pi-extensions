import { marked } from "marked";
import mermaid from "mermaid";
import { useEffect, useMemo, useRef, useState } from "react";
import { PI_CHARTS_LIBRARY } from "../util/pi-charts.js";
import { renderMarkdownInline, sanitizeHtml } from "../util/markdown.js";
import { useSettings } from "../util/settings.js";
import SettingsButton from "./SettingsButton";

/** Sanitize raw HTML context before injecting into sandboxed iframe.
 *  Uses the same DOMPurify config as markdown pipeline for consistency.
 */
function sanitizeHtmlContext(rawHtml: string): string {
    return sanitizeHtml(rawHtml);
}

interface ContextPanelProps {
    context: string;
    contextFormat?: "markdown" | "html";
    question?: string;
}

class MermaidRenderer extends marked.Renderer {
    code({ text, lang }: { text: string; lang?: string }) {
        return lang === "mermaid"
            ? `<div class="mermaid">${text}</div>`
            : super.code({ text, lang, escaped: false });
    }
}

const mermaidRenderer = new MermaidRenderer();

function renderContextMarkdown(text: string): string {
    return sanitizeHtml(
        marked.parse(text, {
            async: false,
            renderer: mermaidRenderer,
        }) as string,
    );
}

function initMermaid(theme: "light" | "dark") {
    try {
        mermaid.initialize({
            startOnLoad: false,
            // securityLevel: "strict" prevents mermaid node labels from
            // rendering raw HTML inside SVG, closing the sanitizer bypass
            // vector that "loose" opens. The default is "strict".
            securityLevel: "strict",
            theme: theme === "dark" ? "dark" : "default",
        });
    } catch {
        // mermaid.run() may still work despite init failure
    }
}

/** Read the current theme CSS variables from the document root */
function getCurrentThemeCssVars(): Record<string, string> {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const vars: Record<string, string> = {};
    const names = [
        "background", "foreground", "card", "card-foreground",
        "popover", "popover-foreground", "primary", "primary-foreground",
        "secondary", "secondary-foreground", "muted", "muted-foreground",
        "accent", "accent-foreground", "destructive", "destructive-foreground",
        "border", "input", "ring", "radius",
    ];
    for (const name of names) {
        vars[name] = computed.getPropertyValue(`--${name}`).trim();
    }
    return vars;
}

function buildCssVarBlock(): string {
    const vars = getCurrentThemeCssVars();
    const entries = Object.entries(vars)
        .map(([name, value]) => `    --${name}: ${value};`)
        .join("\n");
    return `:root {\n${entries}\n}`;
}

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
    if (e.data?.type === "THEME_CHANGED") {
        // Update CSS variables dynamically
        var root = document.documentElement;
        for (var key in e.data.cssVars) {
            root.style.setProperty(key, e.data.cssVars[key]);
        }
        // Toggle dark class
        document.body.classList.toggle("dark", e.data.isDark);
    }
});`;

function buildIframeSrcdoc(rawHtml: string, isDark: boolean): string {
    const sanitized = sanitizeHtmlContext(rawHtml);
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${buildCssVarBlock()}
${IFRAME_CSS}
</style>
<script>
${PI_CHARTS_LIBRARY}
</script>
</head>
<body${isDark ? ' class="dark"' : ''}>
${sanitized}
<script>
${IFRAME_SCRIPT}
</script>
</body>
</html>`;
}

function HtmlContext({
    html,
    resolvedMode,
}: {
    html: string;
    resolvedMode: "light" | "dark";
}) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [loaded, setLoaded] = useState(false);
    const isDark = resolvedMode === "dark";

    const srcdoc = useMemo(
        () => buildIframeSrcdoc(html, isDark),
        [html, isDark],
    );

    // The iframe has an opaque origin (sandbox without allow-same-origin), so we
    // must target "*" for postMessage to be delivered at all.
    // SECURITY: The iframe is sandboxed with allow-scripts only and no network access.
    // The parent controls the srcdoc content entirely, so "*" is acceptable here.
    useEffect(() => {
        const cw = iframeRef.current?.contentWindow;
        if (!cw || !loaded) return;
        cw.postMessage({ type: "THEME_CHANGED", isDark }, "*");
    }, [isDark, loaded]);

    return (
        <iframe
            ref={iframeRef}
            sandbox="allow-scripts"
            csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"
            srcDoc={srcdoc}
            className="flex-1 w-full border-0 min-h-0"
            title="HTML context"
            data-context-panel=""
            onLoad={() => setLoaded(true)}
            /*
             * NOTE: Do NOT add loading="lazy".
             * Glimpse (glimpseui) uses WKWebView on macOS, which applies
             * lazy-loading heuristics even to srcDoc iframes. In some
             * versions the iframe content never renders if lazy is set,
             * leaving the HTML context panel blank.
             */
        />
    );
}

export default function ContextPanel({
    context,
    contextFormat,
    question,
}: ContextPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedMode } = useSettings();
    // Skip expensive markdown parsing when context is raw HTML
    const html = useMemo(
        () => (contextFormat === "html" ? "" : renderContextMarkdown(context)),
        [context, contextFormat],
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: must re-run when markdown content changes to find mermaid nodes.
    useEffect(() => {
        if (contextFormat === "html") return;
        initMermaid(resolvedMode);
        const container = containerRef.current;
        if (!container) return;

        const nodes = container.querySelectorAll<HTMLElement>(".mermaid");
        if (nodes.length === 0) return;

        const id = requestAnimationFrame(() => {
            mermaid.run({ nodes }).catch((err: unknown) => {
                // eslint-disable-next-line no-console
                console.warn("[mermaid] render error:", err);
                for (const node of nodes) {
                    node.textContent = "[Diagram rendering failed]";
                }
            });
        });

        return () => cancelAnimationFrame(id);
    }, [context, resolvedMode, contextFormat]);

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
                            <div
                                className="text-base font-semibold text-foreground leading-relaxed"
                                dangerouslySetInnerHTML={{
                                    __html: renderMarkdownInline(question),
                                }}
                            />
                        </div>
                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                            <SettingsButton />
                        </div>
                    </div>
                </div>
            )}

            {/* Scrollable context: markdown or HTML iframe */}
            <div className={`flex-1 ${contextFormat === "html" ? "overflow-hidden flex flex-col" : "overflow-y-auto scrollbar-hover"}`}>
                {contextFormat === "html" ? (
                    <HtmlContext html={context} resolvedMode={resolvedMode} />
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

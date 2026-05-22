import { marked } from "marked";
import mermaid from "mermaid";
import { useEffect, useMemo, useRef, useState } from "react";
import { PI_CHARTS_LIBRARY } from "../util/pi-charts.js";
import { renderMarkdownInline, sanitizeHtml } from "../util/markdown.js";
import { useSettings } from "../util/settings.js";
import { HelpIcon } from "./icons";
import SettingsButton from "./SettingsButton";

interface ContextPanelProps {
    context: string;
    contextFormat?: "markdown" | "html";
    question?: string;
    onShowShortcuts?: () => void;
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
            securityLevel: "loose",
            theme: theme === "dark" ? "dark" : "default",
        });
    } catch {
        // mermaid.run() may still work despite init failure
    }
}

/** Theme variables for the HTML context iframe, keyed by variable name. */
const IFRAME_CSS_VAR_MAP: Record<string, { light: string; dark: string }> = {
    background: { light: "0 0% 100%", dark: "240 10% 3.9%" },
    foreground: { light: "240 10% 3.9%", dark: "0 0% 98%" },
    card: { light: "0 0% 100%", dark: "240 10% 3.9%" },
    "card-foreground": { light: "240 10% 3.9%", dark: "0 0% 98%" },
    popover: { light: "0 0% 100%", dark: "240 10% 3.9%" },
    "popover-foreground": { light: "240 10% 3.9%", dark: "0 0% 98%" },
    primary: { light: "240 5.9% 10%", dark: "0 0% 98%" },
    "primary-foreground": { light: "0 0% 98%", dark: "240 5.9% 10%" },
    secondary: { light: "240 4.8% 95.9%", dark: "240 3.7% 15.9%" },
    "secondary-foreground": { light: "240 5.9% 10%", dark: "0 0% 98%" },
    muted: { light: "240 4.8% 95.9%", dark: "240 3.7% 15.9%" },
    "muted-foreground": { light: "240 3.8% 46.1%", dark: "240 5% 64.9%" },
    accent: { light: "240 4.8% 95.9%", dark: "240 3.7% 15.9%" },
    "accent-foreground": { light: "240 5.9% 10%", dark: "0 0% 98%" },
    destructive: { light: "0 84.2% 60.2%", dark: "0 62.8% 30.6%" },
    "destructive-foreground": { light: "0 0% 98%", dark: "0 0% 98%" },
    border: { light: "240 5.9% 90%", dark: "240 3.7% 15.9%" },
    input: { light: "240 5.9% 90%", dark: "240 3.7% 15.9%" },
    ring: { light: "240 5.9% 10%", dark: "240 4.9% 83.9%" },
    radius: { light: "0.5rem", dark: "0.5rem" },
};

function buildCssVarBlock(theme: "light" | "dark"): string {
    const selector = theme === "light" ? ":root" : ".dark";
    const entries = Object.entries(IFRAME_CSS_VAR_MAP)
        .map(([name, values]) => `    --${name}: ${values[theme]};`)
        .join("\n");
    return `${selector} {\n${entries}\n}`;
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
${buildCssVarBlock("light")}
${buildCssVarBlock("dark")}
${IFRAME_CSS}
</style>
<script>
${PI_CHARTS_LIBRARY}
</script>
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

    // The iframe has an opaque origin (sandbox without allow-same-origin), so we
    // must target "*" for postMessage to be delivered at all.
    useEffect(() => {
        const cw = iframeRef.current?.contentWindow;
        if (!cw || !loaded) return;
        cw.postMessage({ type: "theme", theme: resolvedTheme }, "*");
    }, [resolvedTheme, loaded]);

    return (
        <iframe
            ref={iframeRef}
            sandbox="allow-scripts"
            srcDoc={srcdoc}
            className="flex-1 w-full border-0 min-h-0"
            title="HTML context"
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
    onShowShortcuts,
}: ContextPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useSettings();
    // Skip expensive markdown parsing when context is raw HTML
    const html = useMemo(
        () => (contextFormat === "html" ? "" : renderContextMarkdown(context)),
        [context, contextFormat],
    );

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
            <div className={`flex-1 ${contextFormat === "html" ? "overflow-hidden flex flex-col" : "overflow-y-auto scrollbar-hover"}`}>
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

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ContextPanel from "../ContextPanel";

vi.mock("mermaid", () => ({
    default: {
        initialize: vi.fn(),
        run: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock("../../util/settings.js", () => ({
    useSettings: () => ({ resolvedTheme: "light" as const }),
}));

vi.mock("../../util/pi-charts.js", () => ({
    PI_CHARTS_LIBRARY: "",
}));

vi.mock("../SettingsButton", () => ({
    default: () => <div data-testid="settings-button" />,
}));

vi.mock("marked", () => ({
    marked: {
        parse: (text: string, opts?: { renderer?: { code?: (args: { text: string; lang?: string }) => string } }) => {
            const renderer = opts?.renderer;
            if (text.includes("```mermaid")) {
                const mermaidText = text.match(/```mermaid\n([\s\S]*?)```/)?.[1] || "";
                return renderer?.code?.({ text: mermaidText, lang: "mermaid" }) || `<div class="mermaid">${mermaidText}</div>`;
            }
            if (text.includes("```")) {
                const codeMatch = text.match(/```(\w+)?\n([\s\S]*?)```/);
                if (codeMatch) {
                    const lang = codeMatch[1] || "";
                    const code = codeMatch[2];
                    return renderer?.code?.({ text: code, lang }) || `<pre><code>${code}</code></pre>`;
                }
            }
            if (text.startsWith("# ")) {
                const heading = text.slice(2).split("\n")[0];
                return `<h1>${heading}</h1>`;
            }
            return `<p>${text}</p>`;
        },
        Renderer: class Renderer {
            code() { return ""; }
        },
    },
}));

vi.mock("../../util/markdown.js", () => ({
    sanitizeHtml: (html: string) => html,
    renderMarkdownInline: (text: string) => `<span>${text}</span>`,
}));

describe("ContextPanel", () => {
    it("renders an iframe with srcdoc when context is provided", () => {
        render(
            <ContextPanel
                context="<h1>Test HTML</h1>"
                contextFormat="html"
            />,
        );
        const iframe = screen.getByTitle("HTML context");
        expect(iframe).toBeInTheDocument();
        expect(iframe).toHaveAttribute("srcDoc");
    });

    it("renders nothing when context is empty", () => {
        const { container } = render(
            <ContextPanel context="" contextFormat="html" />,
        );
        const iframe = container.querySelector("iframe");
        expect(iframe).toBeInTheDocument();
        const srcdoc = iframe?.getAttribute("srcDoc") ?? "";
        // For empty context, the body should be empty before the script tag
        expect(srcdoc).toContain('<body class="light">\n\n<script>');
    });

    it("iframe has sandbox attribute for security", () => {
        render(
            <ContextPanel
                context="<p>Hello</p>"
                contextFormat="html"
            />,
        );
        const iframe = screen.getByTitle("HTML context");
        expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
    });

    it("HTML context is passed directly in srcdoc", () => {
        render(
            <ContextPanel
                context="<h1>Test HTML</h1>"
                contextFormat="html"
            />,
        );
        const iframe = screen.getByTitle("HTML context");
        const srcdoc = iframe.getAttribute("srcDoc") ?? "";
        expect(srcdoc).toContain("<h1>Test HTML</h1>");
    });

    it("Markdown context is rendered to HTML in srcdoc", () => {
        const { container } = render(
            <ContextPanel
                context="# Hello\n\nWorld"
                contextFormat="markdown"
            />,
        );
        const markdownDiv = container.querySelector(".markdown-body");
        expect(markdownDiv).toBeInTheDocument();
        expect(markdownDiv?.innerHTML).toContain("<h1>Hello");
    });

    it("mermaid diagram rendering is triggered when context contains mermaid syntax", async () => {
        const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
            cb(0);
            return 0;
        });

        const { container } = render(
            <ContextPanel
                context="```mermaid\ngraph TD\n  A --> B\n```"
                contextFormat="markdown"
            />,
        );
        const markdownDiv = container.querySelector(".markdown-body");
        expect(markdownDiv).toBeInTheDocument();
        expect(markdownDiv?.innerHTML).toContain('<div class="mermaid">');
        const mermaid = await import("mermaid");
        expect(mermaid.default.initialize).toHaveBeenCalled();
        expect(mermaid.default.run).toHaveBeenCalled();

        rafSpy.mockRestore();
    });

    it("HTML context format renders raw HTML in iframe", () => {
        render(
            <ContextPanel
                context="<div class='custom'>Raw HTML</div>"
                contextFormat="html"
            />,
        );
        const iframe = screen.getByTitle("HTML context");
        const srcdoc = iframe.getAttribute("srcDoc") ?? "";
        expect(srcdoc).toContain("<div class='custom'>Raw HTML</div>");
    });

    it("iframe postMessage sends theme when iframe loads", () => {
        const mockPostMessage = vi.fn();
        const originalDesc = Object.getOwnPropertyDescriptor(
            window.HTMLIFrameElement.prototype,
            "contentWindow",
        );
        Object.defineProperty(window.HTMLIFrameElement.prototype, "contentWindow", {
            get() {
                return { postMessage: mockPostMessage };
            },
            configurable: true,
        });

        render(
            <ContextPanel
                context="<p>Hello</p>"
                contextFormat="html"
            />,
        );
        const iframe = screen.getByTitle("HTML context");
        fireEvent.load(iframe);
        expect(mockPostMessage).toHaveBeenCalledWith(
            { type: "theme", theme: "light" },
            "*",
        );

        // Restore original descriptor
        if (originalDesc) {
            Object.defineProperty(window.HTMLIFrameElement.prototype, "contentWindow", originalDesc);
        }
    });

    it("empty HTML context renders empty iframe body", () => {
        const { container } = render(
            <ContextPanel context="" contextFormat="html" />,
        );
        const iframe = container.querySelector("iframe");
        expect(iframe).toBeInTheDocument();
        const srcdoc = iframe?.getAttribute("srcDoc") ?? "";
        // The body should be empty (no HTML content between body tags)
        const bodyMatch = srcdoc.match(/<body class="light">([\s\S]*?)<\/body>/);
        expect(bodyMatch).toBeTruthy();
        const bodyContent = bodyMatch?.[1] ?? "";
        // After stripping the script tag, the body should be empty
        const stripped = bodyContent.replace(/<script>[\s\S]*?<\/script>/, "").trim();
        expect(stripped).toBe("");
    });

    it("Context panel with no context renders empty iframe", () => {
        const { container } = render(
            <ContextPanel context="" contextFormat="markdown" />,
        );
        const markdownDiv = container.querySelector(".markdown-body");
        expect(markdownDiv).toBeInTheDocument();
        // With no context and markdown format, the markdown body renders an empty paragraph
        const innerHTML = markdownDiv?.innerHTML ?? "";
        expect(innerHTML.trim()).toBe("<p></p>");
    });

    it("logs warning when mermaid render fails", async () => {
        const { default: mermaid } = await import("mermaid");
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        (mermaid.run as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Mermaid error"));

        const { container } = render(
            <ContextPanel context="```mermaid\ngraph TD\nA-->B\n```" contextFormat="markdown" />,
        );
        const markdownDiv = container.querySelector(".markdown-body");
        expect(markdownDiv).toBeInTheDocument();

        // Wait for rAF and mermaid.run to execute
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(consoleSpy).toHaveBeenCalledWith("[mermaid] render error:", expect.any(Error));
        consoleSpy.mockRestore();
    });

    it("renders non-mermaid code blocks with super.code", () => {
        const { container } = render(
            <ContextPanel
                context="```js\nconst x = 1;\n```"
                contextFormat="markdown"
            />,
        );
        const markdownDiv = container.querySelector(".markdown-body");
        expect(markdownDiv).toBeInTheDocument();
        expect(markdownDiv?.innerHTML).toContain("const x = 1");
    });
});

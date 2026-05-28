import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
        parse: (text: string) => {
            if (text.startsWith("# ")) {
                const heading = text.slice(2).split("\n")[0];
                return `<h1>${heading}</h1>`;
            }
            return `<p>${text}</p>`;
        },
        Renderer: class Renderer {},
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
});

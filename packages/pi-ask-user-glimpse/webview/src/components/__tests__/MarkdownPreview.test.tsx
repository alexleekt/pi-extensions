import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MarkdownPreview from "../MarkdownPreview";

vi.mock("../../util/markdown", () => ({
    renderMarkdown: (text: string) => `<p>${text}</p>`,
}));

describe("MarkdownPreview", () => {
    it("renders nothing when text is empty", () => {
        const { container } = render(<MarkdownPreview text="" />);
        expect(container.firstChild).toBeNull();
    });

    it("renders toggle button when text is provided", () => {
        render(<MarkdownPreview text="Hello world" />);
        expect(screen.getByRole("button")).toHaveTextContent("Preview markdown");
    });

    it("toggles preview on button click", () => {
        render(<MarkdownPreview text="Hello world" />);
        const toggle = screen.getByRole("button");
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(toggle).toHaveAttribute("aria-controls", "markdown-preview");
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
    });

    it("shows preview when toggled on", () => {
        render(<MarkdownPreview text="Hello world" />);
        const toggle = screen.getByRole("button");
        fireEvent.click(toggle);
        expect(screen.getByText("Hello world")).toBeInTheDocument();
    });

    it("has correct ARIA attributes", () => {
        render(<MarkdownPreview text="Hello world" />);
        const toggle = screen.getByRole("button");
        fireEvent.click(toggle);
        const preview = screen.getByText("Hello world").closest("div[id='markdown-preview']");
        expect(preview).toHaveAttribute("id", "markdown-preview");
    });
});

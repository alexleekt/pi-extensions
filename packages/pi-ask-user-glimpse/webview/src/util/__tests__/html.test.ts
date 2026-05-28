import { describe, expect, it } from "vitest";
import { escapeHtml, highlightMatch } from "../html.js";

describe("escapeHtml", () => {
    it("escapes special characters", () => {
        expect(escapeHtml("<script>alert('xss')</script>")).toBe(
            "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
        );
    });

    it("escapes ampersand", () => {
        expect(escapeHtml("A & B")).toBe("A &amp; B");
    });

    it("escapes quotes", () => {
        expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
    });
});

describe("highlightMatch", () => {
    it("wraps matching text in mark tags", () => {
        const result = highlightMatch("Hello world", "world");
        expect(result).toContain("<mark");
        expect(result).toContain("world");
        expect(result).toContain("Hello");
    });

    it("escapes HTML in text and query", () => {
        const result = highlightMatch("<script>", "<sc");
        expect(result).toContain("&lt;");
        expect(result).not.toContain("<script>");
    });

    it("returns escaped text when no query", () => {
        const result = highlightMatch("Hello world", "");
        expect(result).toBe("Hello world");
    });

    it("handles case-insensitive matches", () => {
        const result = highlightMatch("Hello World", "world");
        expect(result).toContain("World");
    });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("./App", () => ({
    default: () => <div data-testid="app">Mocked App</div>,
}));

describe("main.tsx bootstrap", () => {
    it("renders App into #root when payload is present", async () => {
        vi.resetModules();
        const root = document.createElement("div");
        root.id = "root";
        document.body.appendChild(root);

        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = {
            type: "single-select",
            question: "Test?",
            options: [{ title: "A" }],
            allowMultiple: false,
            allowFreeform: true,
            allowComment: false,
        };

        await import("./main");
        // Wait for React to render
        await new Promise((r) => setTimeout(r, 50));
        expect(root.textContent).toContain("Mocked App");
        document.body.removeChild(root);
    });

    it("falls back to body innerHTML when #root is missing", async () => {
        vi.resetModules();
        document.body.innerHTML = "";
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = {
            type: "single-select",
            question: "Test?",
            options: [],
            allowMultiple: false,
            allowFreeform: false,
            allowComment: false,
        };

        await expect(import("./main")).rejects.toThrow("#root element not found");
        expect(document.body.innerHTML).toContain("#root element not found");
    });
});

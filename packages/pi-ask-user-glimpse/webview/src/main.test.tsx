import { describe, expect, it, vi } from "vitest";

describe("main.tsx bootstrap", () => {
    it("renders error when #root is missing", async () => {
        // Save original state
        const originalBody = document.body.innerHTML;
        const originalPayload = (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__;
        const root = document.getElementById("root");
        if (root) root.remove();

        // Set a valid payload
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = {
            type: "single-select",
            question: "Test?",
            options: [],
        };

        // Expect the import to throw
        await expect(import("./main")).rejects.toThrow("#root element not found");
        expect(document.body.innerHTML).toContain("Error: #root element not found");

        // Restore original state
        document.body.innerHTML = originalBody;
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = originalPayload;
    });
});

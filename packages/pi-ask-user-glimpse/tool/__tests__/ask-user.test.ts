import { describe, expect, it, vi, beforeEach } from "vitest";
import { askUserHandler } from "../ask-user.js";

const mockPrompt = vi.fn();

vi.mock("glimpseui", () => ({
    prompt: (...args: unknown[]) => mockPrompt(...args),
}));

function buildCtx(overrides = {}) {
    return {
        sessionManager: {
            getSessionName: () => "test-session",
            getEntries: () => [],
        },
        ...overrides,
    };
}

function getText(result: { content: Array<{ type: string; text?: string }> }): string {
    const c = result.content[0];
    return c.type === "text" && c.text ? c.text : "";
}

describe("askUserHandler", () => {
    beforeEach(() => {
        mockPrompt.mockClear();
    });

    it("returns cancelled when signal is aborted", async () => {
        const signal = new AbortController().signal;
        signal.throwIfAborted = () => {};
        Object.defineProperty(signal, "aborted", { value: true });

        const result = await askUserHandler(
            { question: "Test?" },
            signal,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        expect(result.details.cancelled).toBe(true);
    });

    it("returns no UI available when prompt throws", async () => {
        mockPrompt.mockRejectedValue(new Error("Glimpse not available"));

        const result = await askUserHandler(
            { question: "Test?" },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        expect(getText(result)).toContain("No UI available");
        expect(result.details.cancelled).toBe(true);
    });

    it("returns cancelled when result is null", async () => {
        mockPrompt.mockResolvedValue(null);

        const result = await askUserHandler(
            { question: "Test?" },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        expect(result.details.cancelled).toBe(true);
    });

    it("returns cancelled when result.__cancelled is true", async () => {
        mockPrompt.mockResolvedValue({ __cancelled: true });

        const result = await askUserHandler(
            { question: "Test?" },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        expect(result.details.cancelled).toBe(true);
    });

    it("returns formatted response for freeform result", async () => {
        mockPrompt.mockResolvedValue({ kind: "freeform", text: "My answer" });

        const result = await askUserHandler(
            { question: "Test?" },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        expect(getText(result)).toBe("My answer");
        expect(result.details.response?.kind).toBe("freeform");
    });

    it("returns formatted response for selection result", async () => {
        mockPrompt.mockResolvedValue({ kind: "selection", selections: ["Option A"] });

        const result = await askUserHandler(
            { question: "Test?", options: ["Option A", "Option B"] },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        expect(getText(result)).toBe("Option A");
        expect(result.details.response?.kind).toBe("selection");
    });

    it("returns formatted response for questionnaire result", async () => {
        mockPrompt.mockResolvedValue({
            kind: "questionnaire",
            selections: ["Q1: A"],
            questionnaireDetails: [
                { question: "Q1", answer: "A", kind: "selection" },
            ],
        });

        const result = await askUserHandler(
            {
                question: "Test?",
                questions: [
                    { title: "Q1", options: [{ title: "A" }] },
                ],
            },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        expect(getText(result)).toBe("Q1: A");
        expect(result.details.response?.kind).toBe("questionnaire");
    });

    it("calls onMetadata with theme and animation level", async () => {
        mockPrompt.mockResolvedValue({
            kind: "freeform",
            text: "My answer",
            __theme: "dark",
            __animationLevel: "minimal",
        });

        const onMetadata = vi.fn();
        await askUserHandler(
            { question: "Test?" },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
            onMetadata,
        );

        expect(onMetadata).toHaveBeenCalledWith({
            theme: "dark",
            animationLevel: "minimal",
        });
    });

    it("includes followCursor in window options when set", async () => {
        mockPrompt.mockResolvedValue({ kind: "freeform", text: "My answer" });

        await askUserHandler(
            { question: "Test?", followCursor: true },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        const lastCall = mockPrompt.mock.calls[mockPrompt.mock.calls.length - 1];
        const windowOptions = lastCall[1] as Record<string, unknown>;
        expect(windowOptions.followCursor).toBe(true);
    });
});

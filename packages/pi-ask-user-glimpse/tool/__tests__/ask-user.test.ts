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

    it("selects multi-select payload type when allowMultiple is true", async () => {
        mockPrompt.mockResolvedValue({ kind: "selection", selections: ["A"] });

        await askUserHandler(
            { question: "Test?", options: ["A", "B"], allowMultiple: true },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        const lastCall = mockPrompt.mock.calls[mockPrompt.mock.calls.length - 1];
        const html = lastCall[0] as string;
        expect(html).toContain('"type":"multi-select"');
    });

    it("auto-splits long question into question and context", async () => {
        mockPrompt.mockResolvedValue({ kind: "freeform", text: "My answer" });

        const longQuestion = "What is your opinion on this very important topic that requires a detailed response? Please provide a comprehensive answer with examples and references.";

        await askUserHandler(
            { question: longQuestion },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        const lastCall = mockPrompt.mock.calls[mockPrompt.mock.calls.length - 1];
        const html = lastCall[0] as string;
        expect(html).toContain('"question":"What is your opinion on this very important topic that requires a detailed response?"');
        expect(html).toContain('"context":"Please provide a comprehensive answer with examples and references."');
    });

    it("includes options in error response when prompt throws", async () => {
        mockPrompt.mockRejectedValue(new Error("Glimpse not available"));

        const result = await askUserHandler(
            { question: "Test?", options: ["A", "B"] },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        expect(result.details.options).toEqual(["A", "B"]);
    });

    it("verifies signal abort returns early without calling prompt", async () => {
        const controller = new AbortController();
        controller.abort();
        const signal = controller.signal;

        const result = await askUserHandler(
            { question: "Test?" },
            signal,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        expect(getText(result)).toBe("Cancelled");
        expect(result.details.cancelled).toBe(true);
        expect(mockPrompt).not.toHaveBeenCalled();
    });

    it("verifies prompt error returns no UI available message", async () => {
        mockPrompt.mockRejectedValue(new Error("Glimpse not available"));

        const result = await askUserHandler(
            { question: "Test?" },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        expect(getText(result)).toBe(
            "No UI available for ask_user dialog. Please ask the user directly in free-form text.",
        );
        expect((result.details as Record<string, unknown>).error).toBe("No UI available");
    });

    it("verifies followCursor is passed through window options", async () => {
        mockPrompt.mockResolvedValue({ kind: "freeform", text: "My answer" });

        await askUserHandler(
            { question: "Test?", followCursor: true },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        const lastCall = mockPrompt.mock.calls[mockPrompt.mock.calls.length - 1];
        const windowOptions = lastCall[1] as Record<string, unknown>;
        expect(windowOptions.followCursor).toBe(true);
        expect(windowOptions.width).toBe(1200);
        expect(windowOptions.height).toBe(900);
    });

    it("truncates title from long question with only stopwords", async () => {
        mockPrompt.mockResolvedValue({ kind: "freeform", text: "My answer" });

        await askUserHandler(
            { question: "The and of a in to is it that for on with as" },
            undefined,
            buildCtx() as unknown as import("@earendil-works/pi-coding-agent").ExtensionContext,
        );

        const lastCall = mockPrompt.mock.calls[mockPrompt.mock.calls.length - 1];
        const windowOptions = lastCall[1] as Record<string, unknown>;
        const title = windowOptions.title as string;
        expect(title).toContain("The");
        expect(title.length).toBeLessThanOrEqual(60);
    });
});

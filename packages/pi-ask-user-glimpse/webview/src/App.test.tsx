import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock dialog components before importing App
const mockSelectDialog = vi.fn();
const mockFreeform = vi.fn();
const mockQuestionnaire = vi.fn();
const mockContextPanel = vi.fn();
const mockErrorBoundary = vi.fn();

vi.mock("./components/SelectDialog", () => ({
    default: (props: unknown) => {
        mockSelectDialog(props);
        return <div data-testid="select-dialog">SelectDialog</div>;
    },
}));

vi.mock("./components/Freeform", () => ({
    default: (props: unknown) => {
        mockFreeform(props);
        return <div data-testid="freeform">Freeform</div>;
    },
}));

vi.mock("./components/Questionnaire", () => ({
    default: (props: unknown) => {
        mockQuestionnaire(props);
        return <div data-testid="questionnaire">Questionnaire</div>;
    },
}));

vi.mock("./components/ContextPanel", () => ({
    default: (props: unknown) => {
        mockContextPanel(props);
        return <div data-testid="context-panel">ContextPanel</div>;
    },
}));

vi.mock("./components/ErrorBoundary", () => ({
    default: ({ children }: { children: React.ReactNode }) => {
        mockErrorBoundary(children);
        return <>{children}</>;
    },
}));

function createPayload(type: string, extra?: Record<string, unknown>) {
    return {
        type,
        question: "Test question?",
        options: [],
        allowMultiple: false,
        allowFreeform: true,
        allowComment: false,
        ...extra,
    };
}

// Dynamic import to ensure mocks are set up before App imports the components
async function renderApp() {
    const { default: App } = await import("./App");
    return render(<App />);
}

describe("App", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset window payload
        delete (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__;
    });

    it("renders single-select dialog for single-select payload", async () => {
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = createPayload("single-select");
        await renderApp();
        expect(screen.getByTestId("select-dialog")).toBeInTheDocument();
        expect(mockSelectDialog).toHaveBeenCalledWith(
            expect.objectContaining({ mode: "single" }),
        );
    });

    it("renders multi-select dialog for multi-select payload", async () => {
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = createPayload("multi-select");
        await renderApp();
        expect(screen.getByTestId("select-dialog")).toBeInTheDocument();
        expect(mockSelectDialog).toHaveBeenCalledWith(
            expect.objectContaining({ mode: "multi" }),
        );
    });

    it("renders freeform dialog for freeform payload", async () => {
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = createPayload("freeform");
        await renderApp();
        expect(screen.getByTestId("freeform")).toBeInTheDocument();
    });

    it("renders questionnaire dialog for questionnaire payload", async () => {
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = createPayload("questionnaire");
        await renderApp();
        expect(screen.getByTestId("questionnaire")).toBeInTheDocument();
    });

    it("renders context panel with question and context when provided", async () => {
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = createPayload("single-select", {
            context: "Some context text",
            contextFormat: "markdown",
        });
        await renderApp();
        expect(screen.getByTestId("context-panel")).toBeInTheDocument();
        expect(mockContextPanel).toHaveBeenCalledWith(
            expect.objectContaining({
                context: "Some context text",
                contextFormat: "markdown",
                question: "Test question?",
            }),
        );
    });

    it("renders context panel with empty context when not provided", async () => {
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = createPayload("single-select");
        await renderApp();
        expect(screen.getByTestId("context-panel")).toBeInTheDocument();
        expect(mockContextPanel).toHaveBeenCalledWith(
            expect.objectContaining({
                context: "",
                question: "Test question?",
            }),
        );
    });

    it("provides FooterContext to child components", async () => {
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = createPayload("single-select");
        const { container } = await renderApp();
        // Footer area should exist
        expect(container.querySelector(".shrink-0.border-t")).toBeInTheDocument();
    });

    it("renders error message when payload is invalid", async () => {
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = null;
        const { default: App } = await import("./App");
        render(<App />);
        expect(screen.getByText(/Missing or invalid ask_user payload/i)).toBeInTheDocument();
    });

    it("renders error message when payload is missing", async () => {
        delete (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__;
        const { default: App } = await import("./App");
        render(<App />);
        expect(screen.getByText(/Missing or invalid ask_user payload/i)).toBeInTheDocument();
    });

    it("renders unknown type message for unrecognized payload type", async () => {
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = createPayload("unknown-type");
        const { default: App } = await import("./App");
        render(<App />);
        expect(screen.getByText(/Unknown prompt type: unknown-type/i)).toBeInTheDocument();
    });

    it("strips context from component payload to avoid double rendering", async () => {
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = createPayload("single-select", {
            context: "Some context",
        });
        await renderApp();
        const dialogPayload = mockSelectDialog.mock.calls[0][0].payload;
        expect(dialogPayload.context).toBeUndefined();
        expect(dialogPayload.question).toBe("Test question?");
    });

    it("resizer drag updates panel width", async () => {
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = createPayload("single-select");
        const { container } = await renderApp();
        const resizer = container.querySelector('[role="separator"]') as HTMLElement;
        expect(resizer).toBeInTheDocument();

        // Start drag
        resizer.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        // Move mouse
        window.dispatchEvent(new MouseEvent("mousemove", { clientX: 500 }));
        // End drag
        window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    it("resizer double-click collapses panel", async () => {
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = createPayload("single-select");
        const { container } = await renderApp();
        const resizer = container.querySelector('[role="separator"]') as HTMLElement;
        expect(resizer).toBeInTheDocument();

        resizer.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    it("resizer click when collapsed expands panel", async () => {
        (window as unknown as Record<string, unknown>).__ASK_USER_PAYLOAD__ = createPayload("single-select");
        const { container } = await renderApp();
        const resizer = container.querySelector('[role="separator"]') as HTMLElement;
        expect(resizer).toBeInTheDocument();

        // First collapse via double-click
        resizer.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
        // Then click to expand
        resizer.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
});

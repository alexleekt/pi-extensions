import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Freeform from "../Freeform";
import { WithFooterProvider } from "../../test-helpers";

const mockSendToGlimpse = vi.fn();
const mockSendCancelled = vi.fn();

vi.mock("../../util/glimpse", () => ({
    sendToGlimpse: (...args: unknown[]) => mockSendToGlimpse(...args),
    sendCancelled: () => mockSendCancelled(),
}));

function buildPayload(overrides = {}) {
    return {
        type: "freeform" as const,
        question: "Test question?",
        options: [],
        allowComment: false,
        allowFreeform: true,
        allowMultiple: false,
        ...overrides,
    };
}

function renderWithFooter(payload: ReturnType<typeof buildPayload>) {
    return render(
        <WithFooterProvider>
            <Freeform payload={payload} />
        </WithFooterProvider>,
    );
}

describe("Freeform", () => {
    beforeEach(() => {
        mockSendToGlimpse.mockClear();
        mockSendCancelled.mockClear();
    });

    it("renders textarea", () => {
        renderWithFooter(buildPayload());
        expect(
            screen.getByPlaceholderText("Type your answer…"),
        ).toBeInTheDocument();
    });

    it("does not render additional comments", () => {
        renderWithFooter(buildPayload());
        expect(
            screen.queryByText("Additional Comments"),
        ).not.toBeInTheDocument();
    });

    it("submits text", async () => {
        renderWithFooter(buildPayload());

        const mainTextarea = screen.getByPlaceholderText("Type your answer…");
        fireEvent.change(mainTextarea, {
            target: { value: "My main answer" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => {
            expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
        });

        const sent = mockSendToGlimpse.mock.calls[0][0] as Record<string, unknown>;
        expect(sent.kind).toBe("freeform");
        expect(sent.text).toBe("My main answer");
    });

    it("shows cancel confirm when dirty", () => {
        renderWithFooter(buildPayload());

        const mainTextarea = screen.getByPlaceholderText("Type your answer…");
        fireEvent.change(mainTextarea, {
            target: { value: "Dirty text" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
        expect(mockSendCancelled).not.toHaveBeenCalled();
    });

    it("does not show cancel confirm when clean", () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(mockSendCancelled).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });

    it("renders markdown preview when toggled", () => {
        renderWithFooter(buildPayload());

        const mainTextarea = screen.getByPlaceholderText("Type your answer…");
        fireEvent.change(mainTextarea, {
            target: { value: "Preview text" },
        });

        const previewToggle = screen.getByRole("button", { name: "Preview markdown" });
        fireEvent.click(previewToggle);

        expect(document.getElementById("markdown-preview")).toBeInTheDocument();
    });

    it("Stay button dismisses cancel confirm modal", () => {
        renderWithFooter(buildPayload());

        const mainTextarea = screen.getByPlaceholderText("Type your answer…");
        fireEvent.change(mainTextarea, {
            target: { value: "Dirty text" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Stay" }));
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });
});

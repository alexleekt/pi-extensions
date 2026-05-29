import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WithFooterProvider } from "../../test-helpers";
import Freeform from "../Freeform";

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

        const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
            string,
            unknown
        >;
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

        const previewToggle = screen.getByRole("button", {
            name: "Preview markdown",
        });
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

    describe("with allowComment", () => {
        it("shows comment UI when allowComment is true", () => {
            renderWithFooter(buildPayload({ allowComment: true }));
            expect(screen.getByText("Add comment")).toBeInTheDocument();
        });

        it("hides comment UI when allowComment is false", () => {
            renderWithFooter(buildPayload({ allowComment: false }));
            expect(screen.queryByText("Add comment")).not.toBeInTheDocument();
        });

        it("submits comment when provided", async () => {
            renderWithFooter(buildPayload({ allowComment: true }));

            const mainTextarea =
                screen.getByPlaceholderText("Type your answer…");
            fireEvent.change(mainTextarea, {
                target: { value: "My answer" },
            });

            fireEvent.click(screen.getByText("Add comment"));
            const commentTextarea =
                screen.getByPlaceholderText("Optional comment…");
            fireEvent.change(commentTextarea, {
                target: { value: "My comment" },
            });

            fireEvent.click(screen.getByRole("button", { name: "Submit" }));

            await waitFor(() => {
                expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
            });

            const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
                string,
                unknown
            >;
            expect(sent.kind).toBe("freeform");
            expect(sent.text).toBe("My answer");
            expect(sent.comment).toBe("My comment");
        });

        it("does not send whitespace-only comment", async () => {
            renderWithFooter(buildPayload({ allowComment: true }));

            const mainTextarea =
                screen.getByPlaceholderText("Type your answer…");
            fireEvent.change(mainTextarea, {
                target: { value: "My answer" },
            });

            fireEvent.click(screen.getByText("Add comment"));
            const commentTextarea =
                screen.getByPlaceholderText("Optional comment…");
            fireEvent.change(commentTextarea, {
                target: { value: "   " },
            });

            fireEvent.click(screen.getByRole("button", { name: "Submit" }));

            await waitFor(() => {
                expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
            });

            const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
                string,
                unknown
            >;
            expect(sent.kind).toBe("freeform");
            expect(sent.text).toBe("My answer");
            expect(sent.comment).toBeUndefined();
        });

        it("shows cancel confirm when dirty from comment alone", () => {
            renderWithFooter(buildPayload({ allowComment: true }));

            fireEvent.click(screen.getByText("Add comment"));
            const commentTextarea =
                screen.getByPlaceholderText("Optional comment…");
            fireEvent.change(commentTextarea, {
                target: { value: "Dirty comment" },
            });

            fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
            expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
        });

        it("shows Edit comment when comment exists but textarea is hidden", () => {
            renderWithFooter(buildPayload({ allowComment: true }));

            fireEvent.click(screen.getByText("Add comment"));
            const commentTextarea =
                screen.getByPlaceholderText("Optional comment…");
            fireEvent.change(commentTextarea, {
                target: { value: "My comment" },
            });
            fireEvent.click(screen.getByText("Hide comment"));

            expect(screen.getByText("Edit comment")).toBeInTheDocument();
        });
    });
});

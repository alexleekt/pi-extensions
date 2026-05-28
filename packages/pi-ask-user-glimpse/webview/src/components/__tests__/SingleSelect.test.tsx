import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SingleSelect from "../SingleSelect";
import { WithFooterProvider } from "../../test-helpers";

const mockSendToGlimpse = vi.fn();
const mockSendCancelled = vi.fn();

vi.mock("../../util/glimpse", () => ({
    sendToGlimpse: (...args: unknown[]) => mockSendToGlimpse(...args),
    sendCancelled: () => mockSendCancelled(),
}));

vi.mock("../../util/html", () => ({
    renderOptionText: (text: string) => text,
}));

function buildPayload(overrides = {}) {
    return {
        type: "single-select" as const,
        question: "Test question?",
        options: [
            { title: "Option A", description: "First option" },
            { title: "Option B" },
        ],
        allowComment: true,
        allowFreeform: true,
        allowMultiple: false,
        ...overrides,
    };
}

function renderWithFooter(payload: ReturnType<typeof buildPayload>) {
    return render(
        <WithFooterProvider>
            <SingleSelect payload={payload} />
        </WithFooterProvider>,
    );
}

describe("SingleSelect", () => {
    beforeEach(() => {
        mockSendToGlimpse.mockClear();
        mockSendCancelled.mockClear();
    });

    it("renders options and additional comments", () => {
        renderWithFooter(buildPayload());
        expect(screen.getByText("Option A")).toBeInTheDocument();
        expect(screen.getByText("Option B")).toBeInTheDocument();
        expect(screen.getByText("Additional Comments")).toBeInTheDocument();
    });

    it("submits with additional comments when dirty", async () => {
        renderWithFooter(buildPayload());

        // Select an option
        fireEvent.click(screen.getByText("Option A"));

        // Type additional comments
        const commentsTextarea = screen.getByPlaceholderText(
            "Optional additional comments…",
        );
        fireEvent.change(commentsTextarea, {
            target: { value: "My extra thoughts" },
        });

        // Submit
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => {
            expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
        });

        const sent = mockSendToGlimpse.mock.calls[0][0] as Record<string, unknown>;
        expect(sent.kind).toBe("selection");
        expect(sent.selections).toEqual(["Option A"]);
        expect(sent.additionalComments).toBe("My extra thoughts");
    });

    it("submits additional comments even without option selection when freeform is allowed", async () => {
        renderWithFooter(buildPayload());

        // Type only additional comments (no option selected)
        const commentsTextarea = screen.getByPlaceholderText(
            "Optional additional comments…",
        );
        fireEvent.change(commentsTextarea, {
            target: { value: "Only additional comments" },
        });

        // Submit
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => {
            expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
        });

        const sent = mockSendToGlimpse.mock.calls[0][0] as Record<string, unknown>;
        expect(sent.kind).toBe("freeform");
        expect(sent.additionalComments).toBe("Only additional comments");
    });

    it("does not include additionalComments when empty", async () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Option A"));
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => {
            expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
        });

        const sent = mockSendToGlimpse.mock.calls[0][0] as Record<string, unknown>;
        expect(sent.additionalComments).toBeUndefined();
    });

    it("shows cancel confirm when dirty from additional comments alone", () => {
        renderWithFooter(buildPayload());

        const commentsTextarea = screen.getByPlaceholderText(
            "Optional additional comments…",
        );
        fireEvent.change(commentsTextarea, {
            target: { value: "Dirty comment" },
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

    it("hides per-option comment section when allowComment is false but still shows AdditionalComments", () => {
        renderWithFooter(buildPayload({ allowComment: false }));

        // The per-option comment toggle should not be visible
        expect(screen.queryByText("Add comment")).not.toBeInTheDocument();

        // But the global AdditionalComments textarea should still be visible
        expect(screen.getByText("Additional Comments")).toBeInTheDocument();
    });
});

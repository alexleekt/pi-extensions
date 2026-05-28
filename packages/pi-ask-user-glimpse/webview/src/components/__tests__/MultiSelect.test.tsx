import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MultiSelect from "../MultiSelect";
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
        type: "multi-select" as const,
        question: "Test question?",
        options: [
            { title: "Option A", description: "First option" },
            { title: "Option B" },
            { title: "Option C" },
        ],
        allowComment: true,
        allowFreeform: true,
        allowMultiple: true,
        ...overrides,
    };
}

function renderWithFooter(payload: ReturnType<typeof buildPayload>) {
    return render(
        <WithFooterProvider>
            <MultiSelect payload={payload} />
        </WithFooterProvider>,
    );
}

describe("MultiSelect", () => {
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

    it("submits with additional comments when selections are made", async () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Option A"));
        fireEvent.click(screen.getByText("Option B"));

        const commentsTextarea = screen.getByPlaceholderText(
            "Optional additional comments…",
        );
        fireEvent.change(commentsTextarea, {
            target: { value: "My extra thoughts" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => {
            expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
        });

        const sent = mockSendToGlimpse.mock.calls[0][0] as Record<string, unknown>;
        expect(sent.kind).toBe("selection");
        expect(sent.selections).toEqual(["Option A", "Option B"]);
        expect(sent.additionalComments).toBe("My extra thoughts");
    });

    it("submits additional comments with freeform when no selection and freeform allowed", async () => {
        renderWithFooter(buildPayload());

        const commentsTextarea = screen.getByPlaceholderText(
            "Optional additional comments…",
        );
        fireEvent.change(commentsTextarea, {
            target: { value: "Only additional comments" },
        });

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

    it("shows cancel confirm when dirty from selections", () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Option A"));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });

    it("does not show cancel confirm when clean", () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(mockSendCancelled).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });
});

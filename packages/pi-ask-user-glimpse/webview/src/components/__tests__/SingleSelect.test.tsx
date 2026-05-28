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

    it("renders options", () => {
        renderWithFooter(buildPayload());
        expect(screen.getByText("Option A")).toBeInTheDocument();
        expect(screen.getByText("Option B")).toBeInTheDocument();
    });

    it("does not render additional comments section", () => {
        renderWithFooter(buildPayload());
        expect(
            screen.queryByText("Additional Comments"),
        ).not.toBeInTheDocument();
    });

    it("submits selected option", async () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Option A"));
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => {
            expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
        });

        const sent = mockSendToGlimpse.mock.calls[0][0] as Record<string, unknown>;
        expect(sent.kind).toBe("selection");
        expect(sent.selections).toEqual(["Option A"]);
    });

    it("submits per-option comment when provided", async () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Option A"));
        fireEvent.click(screen.getByText("Add comment"));
        const commentTextarea = screen.getByPlaceholderText("Optional comment…");
        fireEvent.change(commentTextarea, {
            target: { value: "My comment" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => {
            expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
        });

        const sent = mockSendToGlimpse.mock.calls[0][0] as Record<string, unknown>;
        expect(sent.kind).toBe("selection");
        expect(sent.selections).toEqual(["Option A"]);
        expect(sent.comment).toBe("My comment");
    });

    it("submits freeform when no option selected and freeform allowed", async () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => {
            expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
        });

        const sent = mockSendToGlimpse.mock.calls[0][0] as Record<string, unknown>;
        expect(sent.kind).toBe("freeform");
    });

    it("shows cancel confirm when dirty from selection", () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Option A"));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
        expect(mockSendCancelled).not.toHaveBeenCalled();
    });

    it("shows cancel confirm when dirty from per-option comment", () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Option A"));
        fireEvent.click(screen.getByText("Add comment"));
        const commentTextarea = screen.getByPlaceholderText("Optional comment…");
        fireEvent.change(commentTextarea, {
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

    it("hides per-option comment section when allowComment is false", () => {
        renderWithFooter(buildPayload({ allowComment: false }));
        expect(screen.queryByText("Add comment")).not.toBeInTheDocument();
    });
});

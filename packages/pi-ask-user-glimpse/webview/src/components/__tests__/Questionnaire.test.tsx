import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Questionnaire from "../Questionnaire";
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
        type: "questionnaire" as const,
        question: "Test questionnaire?",
        options: [],
        questions: [
            {
                title: "Q1",
                description: "First question",
                options: [
                    { title: "Q1-A" },
                    { title: "Q1-B" },
                ],
                allowMultiple: false,
            },
            {
                title: "Q2",
                options: [
                    { title: "Q2-A" },
                    { title: "Q2-B" },
                ],
                allowMultiple: true,
            },
            {
                title: "Q3",
                description: "Freeform question",
            },
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
            <Questionnaire payload={payload} />
        </WithFooterProvider>,
    );
}

describe("Questionnaire", () => {
    beforeEach(() => {
        mockSendToGlimpse.mockClear();
        mockSendCancelled.mockClear();
    });

    it("renders questions and additional comments", () => {
        renderWithFooter(buildPayload());
        expect(screen.getByText("Q1")).toBeInTheDocument();
        expect(screen.getByText("Q2")).toBeInTheDocument();
        expect(screen.getByText("Q3")).toBeInTheDocument();
        expect(screen.getByText("Additional Comments")).toBeInTheDocument();
    });

    it("submits with answers and additional comments", async () => {
        renderWithFooter(buildPayload());

        // Answer Q1
        fireEvent.click(screen.getByText("Q1-A"));

        // Answer Q2 (multi-select)
        fireEvent.click(screen.getByText("Q2-A"));
        fireEvent.click(screen.getByText("Q2-B"));

        // Answer Q3 (freeform)
        const freeformTextarea = screen.getByPlaceholderText("Your answer…");
        fireEvent.change(freeformTextarea, {
            target: { value: "Freeform answer" },
        });

        // Type additional comments
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
        expect(sent.kind).toBe("questionnaire");
        expect(sent.additionalComments).toBe("My extra thoughts");
        expect(Array.isArray(sent.questionnaireDetails)).toBe(true);
        const details = sent.questionnaireDetails as Array<{
            question: string;
            answer: string;
        }>;
        expect(details).toHaveLength(3);
    });

    it("submits only additional comments when no answers provided", async () => {
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
        expect(sent.kind).toBe("questionnaire");
        expect(sent.additionalComments).toBe("Only additional comments");
        const details = sent.questionnaireDetails as Array<unknown>;
        expect(details).toHaveLength(0);
    });

    it("does not include additionalComments when empty", async () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Q1-A"));
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

    it("shows cancel confirm when dirty from answers", () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Q1-A"));
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

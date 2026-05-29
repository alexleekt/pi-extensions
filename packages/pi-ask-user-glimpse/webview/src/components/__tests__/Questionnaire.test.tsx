import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WithFooterProvider } from "../../test-helpers";
import Questionnaire from "../Questionnaire";

const mockSendToGlimpse = vi.fn();
const mockSendCancelled = vi.fn();

vi.mock("../../util/glimpse", () => ({
    sendToGlimpse: (...args: unknown[]) => mockSendToGlimpse(...args),
    sendCancelled: () => mockSendCancelled(),
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
                options: [{ title: "Q1-A" }, { title: "Q1-B" }],
                allowMultiple: false,
            },
            {
                title: "Q2",
                options: [{ title: "Q2-A" }, { title: "Q2-B" }],
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

    it("renders questions", () => {
        renderWithFooter(buildPayload());
        expect(screen.getByText("Q1")).toBeInTheDocument();
        expect(screen.getByText("Q2")).toBeInTheDocument();
        expect(screen.getByText("Q3")).toBeInTheDocument();
    });

    it("does not render additional comments section", () => {
        renderWithFooter(buildPayload());
        expect(
            screen.queryByText("Additional Comments"),
        ).not.toBeInTheDocument();
    });

    it("submits with answers", async () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Q1-A"));
        fireEvent.click(screen.getByText("Q2-A"));
        const freeformTextarea = screen.getByPlaceholderText("Your answer…");
        fireEvent.change(freeformTextarea, {
            target: { value: "Freeform answer" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => {
            expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
        });

        const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
            string,
            unknown
        >;
        expect(sent.kind).toBe("questionnaire");
        expect(Array.isArray(sent.questionnaireDetails)).toBe(true);
        const details = sent.questionnaireDetails as Array<{
            question: string;
            answer: string;
        }>;
        expect(details).toHaveLength(3);
    });

    it("submits per-question comment when provided", async () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Q1-A"));
        fireEvent.click(screen.getAllByText("Add comment")[0]);
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
        expect(sent.kind).toBe("questionnaire");
        const details = sent.questionnaireDetails as Array<{
            question: string;
            answer: string;
            comment?: string;
        }>;
        const q1 = details.find((d) => d.question === "Q1");
        expect(q1?.comment).toBe("My comment");
    });

    it("submits empty questionnaire when no answers provided", async () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => {
            expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
        });

        const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
            string,
            unknown
        >;
        expect(sent.kind).toBe("questionnaire");
        const details = sent.questionnaireDetails as Array<unknown>;
        expect(details).toHaveLength(0);
    });

    it("shows cancel confirm when dirty from answers", () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Q1-A"));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });

    it("shows cancel confirm when dirty from per-question comment", () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Q1-A"));
        fireEvent.click(screen.getAllByText("Add comment")[0]);
        const commentTextarea =
            screen.getByPlaceholderText("Optional comment…");
        fireEvent.change(commentTextarea, {
            target: { value: "Dirty comment" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });

    it("does not show cancel confirm when clean", () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(mockSendCancelled).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });

    it("shows cancel confirm when dirty from comments alone", () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getAllByText("Add comment")[0]);
        const commentTextarea =
            screen.getByPlaceholderText("Optional comment…");
        fireEvent.change(commentTextarea, {
            target: { value: "Just a comment" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    });

    it("Stay button dismisses cancel confirm modal", () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Q1-A"));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Stay" }));
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });

    it("multi-select deselect removes option from answer", () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Q2-A"));
        fireEvent.click(screen.getByText("Q2-B"));

        const q2A = screen
            .getByText("Q2-A")
            .closest("[role='option']") as HTMLElement;
        expect(q2A).toHaveAttribute("aria-selected", "true");

        fireEvent.click(screen.getByText("Q2-A"));
        expect(q2A).toHaveAttribute("aria-selected", "false");
    });

    it("Escape closes per-question comment textarea", () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Q1-A"));
        fireEvent.click(screen.getAllByText("Add comment")[0]);
        expect(
            screen.getByPlaceholderText("Optional comment…"),
        ).toBeInTheDocument();

        fireEvent.keyDown(window, { key: "Escape" });
        expect(
            screen.queryByPlaceholderText("Optional comment…"),
        ).not.toBeInTheDocument();
    });

    it("hides per-question comment buttons when allowComment is false", () => {
        renderWithFooter(buildPayload({ allowComment: false }));
        expect(screen.queryByText("Add comment")).not.toBeInTheDocument();
    });

    it("submits comments on multiple questions simultaneously", async () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Q1-A"));
        fireEvent.click(screen.getByText("Q2-A"));
        const freeformTextarea = screen.getByPlaceholderText("Your answer…");
        fireEvent.change(freeformTextarea, { target: { value: "Q3 answer" } });

        // Open Q1 comment, type, then close
        fireEvent.click(screen.getAllByText("Add comment")[0]);
        const q1Comment =
            screen.getAllByPlaceholderText("Optional comment…")[0];
        fireEvent.change(q1Comment, { target: { value: "Q1 comment" } });
        fireEvent.keyDown(window, { key: "Escape" });
        // After closing, Q1 button changes to "Edit comment"
        expect(screen.getByText("Edit comment")).toBeInTheDocument();

        // Open Q2 comment (now it's the first "Add comment" since Q1 is "Edit comment")
        fireEvent.click(screen.getAllByText("Add comment")[0]);
        const q2Comment =
            screen.getAllByPlaceholderText("Optional comment…")[0];
        fireEvent.change(q2Comment, { target: { value: "Q2 comment" } });
        fireEvent.keyDown(window, { key: "Escape" });

        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => {
            expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
        });

        const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
            string,
            unknown
        >;
        const details = sent.questionnaireDetails as Array<{
            question: string;
            answer: string;
            comment?: string;
        }>;
        const q1 = details.find((d) => d.question === "Q1");
        const q2 = details.find((d) => d.question === "Q2");
        expect(q1?.comment).toBe("Q1 comment");
        expect(q2?.comment).toBe("Q2 comment");
    });

    it("does not send whitespace-only comments", async () => {
        renderWithFooter(buildPayload());

        fireEvent.click(screen.getByText("Q1-A"));
        fireEvent.click(screen.getAllByText("Add comment")[0]);
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
        const details = sent.questionnaireDetails as Array<{
            question: string;
            answer: string;
            comment?: string;
        }>;
        const q1 = details.find((d) => d.question === "Q1");
        expect(q1?.comment).toBeUndefined();
    });
});

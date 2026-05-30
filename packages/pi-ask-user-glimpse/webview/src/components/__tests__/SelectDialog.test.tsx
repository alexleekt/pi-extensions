import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WithFooterProvider } from "../../test-helpers";
import SelectDialog from "../SelectDialog";

const mockSendToGlimpse = vi.fn();
const mockSendCancelled = vi.fn();

vi.mock("../../util/glimpse", () => ({
    sendToGlimpse: (...args: unknown[]) => mockSendToGlimpse(...args),
    sendCancelled: () => mockSendCancelled(),
    sendCancelledSafe: () => {
        mockSendCancelled();
        return true;
    },
}));

function buildPayload(mode: "single" | "multi", overrides = {}) {
    return {
        type:
            mode === "single"
                ? ("single-select" as const)
                : ("multi-select" as const),
        question: "Test question?",
        options: [
            { title: "Option A", description: "First option" },
            { title: "Option B" },
        ],
        allowComment: true,
        allowFreeform: true,
        allowMultiple: mode === "multi",
        ...overrides,
    };
}

function renderWithFooter(
    mode: "single" | "multi",
    payload: ReturnType<typeof buildPayload>,
) {
    return render(
        <WithFooterProvider>
            <SelectDialog payload={payload} mode={mode} />
        </WithFooterProvider>,
    );
}

describe("SelectDialog", () => {
    beforeEach(() => {
        mockSendToGlimpse.mockClear();
        mockSendCancelled.mockClear();
    });

    describe("single mode", () => {
        it("renders options", () => {
            renderWithFooter("single", buildPayload("single"));
            expect(screen.getByText("Option A")).toBeInTheDocument();
            expect(screen.getByText("Option B")).toBeInTheDocument();
        });

        it("does not render additional comments section", () => {
            renderWithFooter("single", buildPayload("single"));
            expect(
                screen.queryByText("Additional Comments"),
            ).not.toBeInTheDocument();
        });

        it("submits selected option", async () => {
            renderWithFooter("single", buildPayload("single"));

            fireEvent.click(screen.getByText("Option A"));
            fireEvent.click(screen.getByRole("button", { name: "Submit" }));

            await waitFor(() => {
                expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
            });

            const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
                string,
                unknown
            >;
            expect(sent.kind).toBe("selection");
            expect(sent.selections).toEqual(["Option A"]);
        });

        it("submits per-option comment when provided", async () => {
            renderWithFooter("single", buildPayload("single"));

            fireEvent.click(screen.getByText("Option A"));
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
            expect(sent.kind).toBe("selection");
            expect(sent.selections).toEqual(["Option A"]);
            expect(sent.comment).toBe("My comment");
        });

        it("shows Edit comment when comment exists but textarea is hidden", () => {
            renderWithFooter("single", buildPayload("single"));

            fireEvent.click(screen.getByText("Option A"));
            fireEvent.click(screen.getByText("Add comment"));
            const commentTextarea =
                screen.getByPlaceholderText("Optional comment…");
            fireEvent.change(commentTextarea, {
                target: { value: "My comment" },
            });
            // Click the Hide comment button to close the textarea
            fireEvent.click(screen.getByText("Hide comment"));

            expect(screen.getByText("Edit comment")).toBeInTheDocument();
        });

        it("submits freeform when no option selected and freeform allowed", async () => {
            renderWithFooter("single", buildPayload("single"));

            fireEvent.click(screen.getByRole("button", { name: "Submit" }));

            await waitFor(() => {
                expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
            });

            const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
                string,
                unknown
            >;
            expect(sent.kind).toBe("freeform");
        });

        it("shows cancel confirm when dirty from selection", () => {
            renderWithFooter("single", buildPayload("single"));

            fireEvent.click(screen.getByText("Option A"));
            fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

            expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
            expect(mockSendCancelled).not.toHaveBeenCalled();
        });

        it("shows cancel confirm when dirty from per-option comment", () => {
            renderWithFooter("single", buildPayload("single"));

            fireEvent.click(screen.getByText("Option A"));
            fireEvent.click(screen.getByText("Add comment"));
            const commentTextarea =
                screen.getByPlaceholderText("Optional comment…");
            fireEvent.change(commentTextarea, {
                target: { value: "Dirty comment" },
            });
            fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

            expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
            expect(mockSendCancelled).not.toHaveBeenCalled();
        });

        it("does not show cancel confirm when clean", () => {
            renderWithFooter("single", buildPayload("single"));

            fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

            expect(mockSendCancelled).toHaveBeenCalledTimes(1);
            expect(
                screen.queryByText("Unsaved changes"),
            ).not.toBeInTheDocument();
        });

        it("hides per-option comment section when allowComment is false", () => {
            renderWithFooter(
                "single",
                buildPayload("single", { allowComment: false }),
            );
            expect(screen.queryByText("Add comment")).not.toBeInTheDocument();
        });

        it("ArrowDown moves focus to next option", async () => {
            renderWithFooter("single", buildPayload("single"));
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option B",
                );
            });
        });

        it("ArrowUp moves focus to previous option", async () => {
            renderWithFooter("single", buildPayload("single"));
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option B",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowUp" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
        });

        it("Enter on focused option submits it", async () => {
            renderWithFooter("single", buildPayload("single"));
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            fireEvent.keyDown(document.body, { key: "Enter" });
            await waitFor(() => {
                expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
            });
            const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
                string,
                unknown
            >;
            expect(sent.kind).toBe("selection");
            expect(sent.selections).toEqual(["Option A"]);
        });

        it("number key 1 selects the first option", async () => {
            renderWithFooter("single", buildPayload("single"));
            fireEvent.keyDown(document.body, { key: "1" });
            await waitFor(() => {
                const optionA = screen
                    .getByText("Option A")
                    .closest("[role='option']") as HTMLElement;
                expect(optionA).toHaveAttribute("aria-selected", "true");
            });
        });

        it("clicking an option syncs activeIndex to that option", async () => {
            renderWithFooter("single", buildPayload("single"));
            fireEvent.click(screen.getByText("Option B"));
            const optionB = screen
                .getByText("Option B")
                .closest("[role='option']") as HTMLElement;
            expect(optionB).toHaveClass("ring-2");
            expect(optionB).toHaveAttribute("tabIndex", "0");
        });

        it("minus key selects freeform option", async () => {
            renderWithFooter("single", buildPayload("single"));
            fireEvent.keyDown(document.body, { key: "-" });
            await waitFor(() => {
                const freeform = screen
                    .getByText("My answer isn't listed above")
                    .closest("[role='option']") as HTMLElement;
                expect(freeform).toHaveAttribute("aria-selected", "true");
            });
        });

        it("ArrowDown navigates to freeform option after last regular option", async () => {
            renderWithFooter("single", buildPayload("single"));
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option B",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                const freeform = screen
                    .getByText("My answer isn't listed above")
                    .closest("[role='option']") as HTMLElement;
                expect(document.activeElement).toBe(freeform);
            });
        });

        it("ArrowUp from first option stays at first option", async () => {
            renderWithFooter("single", buildPayload("single"));
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowUp" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
        });

        it("Enter on freeform option does NOT submit (only selects)", async () => {
            renderWithFooter("single", buildPayload("single"));
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option B",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                const freeform = screen
                    .getByText("My answer isn't listed above")
                    .closest("[role='option']") as HTMLElement;
                expect(document.activeElement).toBe(freeform);
            });
            fireEvent.keyDown(document.body, { key: "Enter" });
            await waitFor(() => {
                const freeform = screen
                    .getByText("My answer isn't listed above")
                    .closest("[role='option']") as HTMLElement;
                expect(freeform).toHaveAttribute("aria-selected", "true");
            });
            expect(mockSendToGlimpse).not.toHaveBeenCalled();
        });

        it("Enter fallback submits active option when no OptionCard is focused", async () => {
            renderWithFooter("single", buildPayload("single"));
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option B",
                );
            });
            (document.activeElement as HTMLElement)?.blur();
            fireEvent.keyDown(document.body, { key: "Enter" });
            await waitFor(() => {
                expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
            });
            const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
                string,
                unknown
            >;
            expect(sent.kind).toBe("selection");
            expect(sent.selections).toEqual(["Option B"]);
        });

        it("Enter fallback selects freeform when activeIndex is at freeform", async () => {
            renderWithFooter("single", buildPayload("single"));
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option B",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                const freeform = screen
                    .getByText("My answer isn't listed above")
                    .closest("[role='option']") as HTMLElement;
                expect(document.activeElement).toBe(freeform);
            });
            (document.activeElement as HTMLElement)?.blur();
            fireEvent.keyDown(document.body, { key: "Enter" });
            await waitFor(() => {
                const freeform = screen
                    .getByText("My answer isn't listed above")
                    .closest("[role='option']") as HTMLElement;
                expect(freeform).toHaveAttribute("aria-selected", "true");
            });
            expect(mockSendToGlimpse).not.toHaveBeenCalled();
        });
    });

    describe("multi mode", () => {
        it("renders options", () => {
            renderWithFooter("multi", buildPayload("multi"));
            expect(screen.getByText("Option A")).toBeInTheDocument();
            expect(screen.getByText("Option B")).toBeInTheDocument();
        });

        it("does not render additional comments section", () => {
            renderWithFooter("multi", buildPayload("multi"));
            expect(
                screen.queryByText("Additional Comments"),
            ).not.toBeInTheDocument();
        });

        it("submits selections", async () => {
            renderWithFooter("multi", buildPayload("multi"));

            fireEvent.click(screen.getByText("Option A"));
            fireEvent.click(screen.getByText("Option B"));
            fireEvent.click(screen.getByRole("button", { name: "Submit" }));

            await waitFor(() => {
                expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
            });

            const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
                string,
                unknown
            >;
            expect(sent.kind).toBe("selection");
            expect(sent.selections).toEqual(["Option A", "Option B"]);
        });

        it("submits per-option comment when provided", async () => {
            renderWithFooter("multi", buildPayload("multi"));

            fireEvent.click(screen.getByText("Option A"));
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
            expect(sent.kind).toBe("selection");
            expect(sent.selections).toEqual(["Option A"]);
            expect(sent.comment).toBe("My comment");
        });

        it("submits freeform when no selection and freeform allowed", async () => {
            renderWithFooter("multi", buildPayload("multi"));

            fireEvent.click(screen.getByRole("button", { name: "Submit" }));

            await waitFor(() => {
                expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
            });

            const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
                string,
                unknown
            >;
            expect(sent.kind).toBe("freeform");
        });

        it("shows cancel confirm when dirty from selections", () => {
            renderWithFooter("multi", buildPayload("multi"));

            fireEvent.click(screen.getByText("Option A"));
            fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

            expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
            expect(mockSendCancelled).not.toHaveBeenCalled();
        });

        it("shows cancel confirm when dirty from per-option comment", () => {
            renderWithFooter("multi", buildPayload("multi"));

            fireEvent.click(screen.getByText("Option A"));
            fireEvent.click(screen.getByText("Add comment"));
            const commentTextarea =
                screen.getByPlaceholderText("Optional comment…");
            fireEvent.change(commentTextarea, {
                target: { value: "Dirty comment" },
            });
            fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

            expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
            expect(mockSendCancelled).not.toHaveBeenCalled();
        });

        it("does not show cancel confirm when clean", () => {
            renderWithFooter("multi", buildPayload("multi"));

            fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

            expect(mockSendCancelled).toHaveBeenCalledTimes(1);
            expect(
                screen.queryByText("Unsaved changes"),
            ).not.toBeInTheDocument();
        });

        it("select all button selects all regular options", () => {
            renderWithFooter("multi", buildPayload("multi"));

            fireEvent.click(screen.getByText("Select all"));
            expect(screen.getByText("2 selected")).toBeInTheDocument();
        });

        it("number key 1 selects the first option in multi-select", async () => {
            renderWithFooter("multi", buildPayload("multi"));
            fireEvent.keyDown(document.body, { key: "1" });
            await waitFor(() => {
                const optionA = screen
                    .getByText("Option A")
                    .closest("[role='option']") as HTMLElement;
                expect(optionA).toHaveAttribute("aria-selected", "true");
            });
        });

        it("ArrowUp from freeform stays at freeform when no options exist", async () => {
            renderWithFooter("single", buildPayload("single", { options: [] }));
            await waitFor(() => {
                const freeform = screen
                    .getByText("My answer isn't listed above")
                    .closest("[role='option']") as HTMLElement;
                expect(document.activeElement).toBe(freeform);
            });
            fireEvent.keyDown(document.body, { key: "ArrowUp" });
            await waitFor(() => {
                const freeform = screen
                    .getByText("My answer isn't listed above")
                    .closest("[role='option']") as HTMLElement;
                expect(document.activeElement).toBe(freeform);
            });
        });

        it("select none button clears all selections", () => {
            renderWithFooter("multi", buildPayload("multi"));

            fireEvent.click(screen.getByText("Select all"));
            expect(screen.getByText("2 selected")).toBeInTheDocument();

            fireEvent.click(screen.getByText("Select none"));
            expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
        });

        it("selects all option selects all regular options", () => {
            renderWithFooter(
                "multi",
                buildPayload("multi", {
                    options: [
                        { title: "All of the above" },
                        { title: "Option A" },
                        { title: "Option B" },
                    ],
                }),
            );

            fireEvent.click(screen.getByText("All of the above"));
            expect(screen.getByText("2 selected")).toBeInTheDocument();
        });

        it("selects all option selects all regular options in single-select", () => {
            renderWithFooter(
                "single",
                buildPayload("single", {
                    options: [
                        { title: "All of the above" },
                        { title: "Option A" },
                        { title: "Option B" },
                    ],
                }),
            );

            fireEvent.click(screen.getByText("All of the above"));
            const allOption = screen
                .getByText("All of the above")
                .closest("[role='option']") as HTMLElement;
            expect(allOption).toHaveAttribute("aria-selected", "true");
        });

        it("deselecting regular option removes select-all in multi-select", () => {
            renderWithFooter(
                "multi",
                buildPayload("multi", {
                    options: [
                        { title: "All of the above" },
                        { title: "Option A" },
                        { title: "Option B" },
                    ],
                }),
            );

            fireEvent.click(screen.getByText("All of the above"));
            expect(screen.getByText("2 selected")).toBeInTheDocument();
            fireEvent.click(screen.getByText("Option A"));
            expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
        });

        it("submits freeform alongside regular options in multi-select", async () => {
            renderWithFooter("multi", buildPayload("multi"));

            fireEvent.click(screen.getByText("Option A"));
            fireEvent.click(screen.getByText("My answer isn't listed above"));
            fireEvent.click(screen.getByRole("button", { name: "Submit" }));

            await waitFor(() => {
                expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
            });

            const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
                string,
                unknown
            >;
            expect(sent.kind).toBe("selection");
            expect(sent.selections).toEqual([
                "Option A",
                "My answer isn't listed above",
            ]);
        });

        it("ArrowDown navigates to next option and updates activeIndex in multi-select", async () => {
            renderWithFooter("multi", buildPayload("multi"));
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option B",
                );
            });
        });

        it("ArrowUp navigates to previous option and updates activeIndex in multi-select", async () => {
            renderWithFooter("multi", buildPayload("multi"));
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option B",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowUp" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
        });

        it("ArrowDown from last option stays at last when no freeform", async () => {
            renderWithFooter(
                "multi",
                buildPayload("multi", { allowFreeform: false }),
            );
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option B",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option B",
                );
            });
        });

        it("ArrowDown from freeform option stays at freeform", async () => {
            renderWithFooter("multi", buildPayload("multi"));
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option B",
                );
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                const freeform = screen
                    .getByText("My answer isn't listed above")
                    .closest("[role='option']") as HTMLElement;
                expect(document.activeElement).toBe(freeform);
            });
            fireEvent.keyDown(document.body, { key: "ArrowDown" });
            await waitFor(() => {
                const freeform = screen
                    .getByText("My answer isn't listed above")
                    .closest("[role='option']") as HTMLElement;
                expect(document.activeElement).toBe(freeform);
            });
        });

        it("minus key toggles freeform option in multi-select mode", async () => {
            renderWithFooter("multi", buildPayload("multi"));
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            fireEvent.keyDown(document.body, { key: "-" });
            await waitFor(() => {
                const freeform = screen
                    .getByText("My answer isn't listed above")
                    .closest("[role='option']") as HTMLElement;
                expect(freeform).toHaveAttribute("aria-selected", "true");
                expect(document.activeElement).toBe(freeform);
            });
        });

        it("clicking an option syncs activeIndex to that option in multi-select", async () => {
            renderWithFooter("multi", buildPayload("multi"));
            fireEvent.click(screen.getByText("Option B"));
            const optionB = screen
                .getByText("Option B")
                .closest("[role='option']") as HTMLElement;
            expect(optionB).toHaveClass("ring-2");
            expect(optionB).toHaveAttribute("tabIndex", "0");
        });

        it("Space key toggles option in multi-select mode", async () => {
            renderWithFooter("multi", buildPayload("multi"));
            await waitFor(() => {
                expect(document.activeElement).toHaveAttribute(
                    "data-option",
                    "Option A",
                );
            });
            const optionA = screen
                .getByText("Option A")
                .closest("[role='option']") as HTMLElement;
            fireEvent.keyDown(optionA, { key: " " });
            await waitFor(() => {
                expect(optionA).toHaveAttribute("aria-selected", "true");
            });
            fireEvent.keyDown(optionA, { key: " " });
            await waitFor(() => {
                expect(optionA).toHaveAttribute("aria-selected", "false");
            });
        });

        it("renders empty options message with freeform", () => {
            renderWithFooter("single", buildPayload("single", { options: [] }));
            expect(
                screen.getByText("No options available."),
            ).toBeInTheDocument();
            expect(
                screen.getByText("My answer isn't listed above"),
            ).toBeInTheDocument();
        });

        it("submits freeform option when selected", async () => {
            renderWithFooter("single", buildPayload("single"));

            fireEvent.click(screen.getByText("My answer isn't listed above"));
            fireEvent.click(screen.getByRole("button", { name: "Submit" }));

            await waitFor(() => {
                expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
            });

            const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
                string,
                unknown
            >;
            expect(sent.kind).toBe("freeform");
        });

        it("Clear all button clears selections in multi-select", () => {
            renderWithFooter("multi", buildPayload("multi"));
            fireEvent.click(screen.getByText("Select all"));
            expect(screen.getByText("2 selected")).toBeInTheDocument();
            fireEvent.click(screen.getByText("Clear all"));
            expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
        });
    });

    it("Stay button dismisses cancel confirm modal", () => {
        renderWithFooter("single", buildPayload("single"));
        fireEvent.click(screen.getByText("Option A"));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Stay" }));
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });

    it("clicking select-all again re-selects all regular options", () => {
        renderWithFooter(
            "multi",
            buildPayload("multi", {
                options: [
                    { title: "All of the above" },
                    { title: "Option A" },
                    { title: "Option B" },
                ],
            }),
        );
        fireEvent.click(screen.getByText("All of the above"));
        expect(screen.getByText("2 selected")).toBeInTheDocument();
        fireEvent.click(screen.getByText("Option A"));
        expect(screen.getByText("1 selected")).toBeInTheDocument();
        fireEvent.click(screen.getByText("All of the above"));
        expect(screen.getByText("2 selected")).toBeInTheDocument();
    });

    it("Escape closes per-option comment textarea", () => {
        renderWithFooter("single", buildPayload("single"));
        fireEvent.click(screen.getByText("Option A"));
        fireEvent.click(screen.getByText("Add comment"));
        expect(
            screen.getByPlaceholderText("Optional comment…"),
        ).toBeInTheDocument();
        fireEvent.keyDown(window, { key: "Escape" });
        expect(
            screen.queryByPlaceholderText("Optional comment…"),
        ).not.toBeInTheDocument();
    });

    it("hides per-option comment section when allowComment is false in multi mode", () => {
        renderWithFooter(
            "multi",
            buildPayload("multi", { allowComment: false }),
        );
        expect(screen.queryByText("Add comment")).not.toBeInTheDocument();
    });

    it("does not send whitespace-only comment", async () => {
        renderWithFooter("single", buildPayload("single"));

        fireEvent.click(screen.getByText("Option A"));
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
        expect(sent.kind).toBe("selection");
        expect(sent.selections).toEqual(["Option A"]);
        expect(sent.comment).toBeUndefined();
    });

    it("submits comment-only in single-select when freeform allowed", async () => {
        renderWithFooter("single", buildPayload("single"));

        fireEvent.click(screen.getByText("Add comment"));
        const commentTextarea =
            screen.getByPlaceholderText("Optional comment…");
        fireEvent.change(commentTextarea, {
            target: { value: "Just a comment" },
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
        expect(sent.comment).toBe("Just a comment");
    });

    it("Escape closes comment textarea in multi-select", () => {
        renderWithFooter("multi", buildPayload("multi"));
        fireEvent.click(screen.getByText("Option A"));
        fireEvent.click(screen.getByText("Add comment"));
        expect(
            screen.getByPlaceholderText("Optional comment…"),
        ).toBeInTheDocument();
        fireEvent.keyDown(window, { key: "Escape" });
        expect(
            screen.queryByPlaceholderText("Optional comment…"),
        ).not.toBeInTheDocument();
    });

    it("renders MarkdownPreview when comment is visible", () => {
        renderWithFooter("single", buildPayload("single"));
        fireEvent.click(screen.getByText("Option A"));
        fireEvent.click(screen.getByText("Add comment"));
        const commentTextarea =
            screen.getByPlaceholderText("Optional comment…");
        fireEvent.change(commentTextarea, {
            target: { value: "**bold**" },
        });
        const previewToggle = screen.getByRole("button", {
            name: "Preview markdown",
        });
        fireEvent.click(previewToggle);
        expect(document.getElementById("markdown-preview")).toBeInTheDocument();
    });

    it("submits comment with multi-select selections", async () => {
        renderWithFooter("multi", buildPayload("multi"));

        fireEvent.click(screen.getByText("Option A"));
        fireEvent.click(screen.getByText("Option B"));
        fireEvent.click(screen.getByText("Add comment"));
        const commentTextarea =
            screen.getByPlaceholderText("Optional comment…");
        fireEvent.change(commentTextarea, {
            target: { value: "Multi comment" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => {
            expect(mockSendToGlimpse).toHaveBeenCalledTimes(1);
        });

        const sent = mockSendToGlimpse.mock.calls[0][0] as Record<
            string,
            unknown
        >;
        expect(sent.kind).toBe("selection");
        expect(sent.selections).toEqual(["Option A", "Option B"]);
        expect(sent.comment).toBe("Multi comment");
    });
});

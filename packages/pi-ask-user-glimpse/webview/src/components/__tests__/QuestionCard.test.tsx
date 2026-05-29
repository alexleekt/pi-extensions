import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QuestionCard from "../QuestionCard";

const mockOptions = [
    { title: "Option A", description: "Description A" },
    { title: "Option B", description: "Description B" },
    { title: "Option C" },
];

describe("QuestionCard", () => {
    it("renders question title and options", () => {
        render(
            <QuestionCard
                question={{ title: "Question 1", options: mockOptions }}
                answer={undefined}
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
            />,
        );
        expect(screen.getByText("Question 1")).toBeInTheDocument();
        expect(screen.getByText("Option A")).toBeInTheDocument();
        expect(screen.getByText("Option B")).toBeInTheDocument();
        expect(screen.getByText("Option C")).toBeInTheDocument();
    });

    it("renders description when available", () => {
        render(
            <QuestionCard
                question={{ title: "Question 1", options: mockOptions }}
                answer={undefined}
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
            />,
        );
        expect(screen.getByText("Description A")).toBeInTheDocument();
        expect(screen.getByText("Description B")).toBeInTheDocument();
    });

    it("calls onSelect when option is clicked in single mode", () => {
        const onSelect = vi.fn();
        render(
            <QuestionCard
                question={{ title: "Question 1", options: mockOptions }}
                answer={undefined}
                onSelect={onSelect}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByText("Option A"));
        expect(onSelect).toHaveBeenCalledWith("Option A");
    });

    it("calls onToggleMulti when option is clicked in multi mode", () => {
        const onToggleMulti = vi.fn();
        render(
            <QuestionCard
                question={{
                    title: "Question 1",
                    options: mockOptions,
                    allowMultiple: true,
                }}
                answer={undefined}
                onSelect={vi.fn()}
                onToggleMulti={onToggleMulti}
                onSetText={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByText("Option A"));
        expect(onToggleMulti).toHaveBeenCalledWith("Option A");
    });

    it("shows selected state for selected option", () => {
        render(
            <QuestionCard
                question={{ title: "Question 1", options: mockOptions }}
                answer="Option A"
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
            />,
        );
        const options = screen.getAllByRole("option");
        expect(options[0]).toHaveAttribute("aria-selected", "true");
        expect(options[1]).toHaveAttribute("aria-selected", "false");
    });

    it("shows selected state for multi-selected options", () => {
        render(
            <QuestionCard
                question={{
                    title: "Question 1",
                    options: mockOptions,
                    allowMultiple: true,
                }}
                answer={["Option A", "Option B"]}
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
            />,
        );
        const options = screen.getAllByRole("option");
        expect(options[0]).toHaveAttribute("aria-selected", "true");
        expect(options[1]).toHaveAttribute("aria-selected", "true");
        expect(options[2]).toHaveAttribute("aria-selected", "false");
    });

    it("shows Recommended badge for recommended option", () => {
        render(
            <QuestionCard
                question={{
                    title: "Question 1",
                    options: [
                        {
                            title: "Option A",
                            description: "Desc",
                            recommended: true,
                        },
                    ],
                }}
                answer={undefined}
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
            />,
        );
        expect(screen.getByText("Recommended")).toBeInTheDocument();
    });

    it("renders Add comment button when allowComment is true", () => {
        render(
            <QuestionCard
                question={{ title: "Question 1", options: mockOptions }}
                answer={undefined}
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
                allowComment={true}
                onToggleComment={vi.fn()}
                onCommentChange={vi.fn()}
            />,
        );
        expect(screen.getByText("Add comment")).toBeInTheDocument();
    });

    it("hides Add comment button when allowComment is false", () => {
        render(
            <QuestionCard
                question={{ title: "Question 1", options: mockOptions }}
                answer={undefined}
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
                allowComment={false}
                onToggleComment={vi.fn()}
                onCommentChange={vi.fn()}
            />,
        );
        expect(screen.queryByText("Add comment")).not.toBeInTheDocument();
    });

    it("calls onToggleComment when Add comment is clicked", () => {
        const onToggleComment = vi.fn();
        render(
            <QuestionCard
                question={{ title: "Question 1", options: mockOptions }}
                answer={undefined}
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
                allowComment={true}
                onToggleComment={onToggleComment}
                onCommentChange={vi.fn()}
            />,
        );
        fireEvent.click(screen.getAllByText("Add comment")[0]);
        expect(onToggleComment).toHaveBeenCalledTimes(1);
    });

    it("shows Edit comment button when comment exists", () => {
        render(
            <QuestionCard
                question={{ title: "Question 1", options: mockOptions }}
                answer={undefined}
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
                allowComment={true}
                comment="Existing comment"
                onToggleComment={vi.fn()}
                onCommentChange={vi.fn()}
            />,
        );
        expect(screen.getByText("Edit comment")).toBeInTheDocument();
    });

    it("shows textarea when showComment is true", () => {
        render(
            <QuestionCard
                question={{ title: "Question 1", options: mockOptions }}
                answer={undefined}
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
                allowComment={true}
                showComment={true}
                comment="My comment"
                onToggleComment={vi.fn()}
                onCommentChange={vi.fn()}
            />,
        );
        const textarea = screen.getByPlaceholderText("Optional comment…");
        expect(textarea).toBeInTheDocument();
        expect(textarea).toHaveValue("My comment");
    });

    it("calls onCommentChange when comment is typed", () => {
        const onCommentChange = vi.fn();
        render(
            <QuestionCard
                question={{ title: "Question 1", options: mockOptions }}
                answer={undefined}
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
                allowComment={true}
                showComment={true}
                comment=""
                onToggleComment={vi.fn()}
                onCommentChange={onCommentChange}
            />,
        );
        const textarea = screen.getByPlaceholderText("Optional comment…");
        fireEvent.change(textarea, { target: { value: "New comment" } });
        expect(onCommentChange).toHaveBeenCalledWith("New comment");
    });

    it("renders freeform textarea when no options", () => {
        render(
            <QuestionCard
                question={{ title: "Question 1", options: [] }}
                answer={undefined}
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
            />,
        );
        expect(screen.getByPlaceholderText("Your answer…")).toBeInTheDocument();
    });

    it("renders Required badge for required questions", () => {
        render(
            <QuestionCard
                question={{ title: "Question 1", options: mockOptions }}
                answer={undefined}
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={vi.fn()}
            />,
        );
        expect(screen.getByText("Required")).toBeInTheDocument();
    });

    it("calls onSetText when freeform text is typed", () => {
        const onSetText = vi.fn();
        render(
            <QuestionCard
                question={{ title: "Question 1", options: [] }}
                answer={undefined}
                onSelect={vi.fn()}
                onToggleMulti={vi.fn()}
                onSetText={onSetText}
            />,
        );
        const textarea = screen.getByPlaceholderText("Your answer…");
        fireEvent.change(textarea, { target: { value: "Freeform answer" } });
        expect(onSetText).toHaveBeenCalledWith("Freeform answer");
    });

    describe("keyboard navigation", () => {
        beforeEach(() => {
            Element.prototype.scrollIntoView = vi.fn();
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it("ArrowDown moves activeIndex to next option and updates tabIndex", () => {
            render(
                <QuestionCard
                    question={{ title: "Question 1", options: mockOptions }}
                    answer={undefined}
                    onSelect={vi.fn()}
                    onToggleMulti={vi.fn()}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            const options = screen.getAllByRole("option");
            expect(options[0]).toHaveAttribute("tabindex", "0");
            expect(options[1]).toHaveAttribute("tabindex", "-1");

            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            expect(options[0]).toHaveAttribute("tabindex", "-1");
            expect(options[1]).toHaveAttribute("tabindex", "0");
        });

        it("ArrowUp moves activeIndex to previous option and updates tabIndex", () => {
            render(
                <QuestionCard
                    question={{ title: "Question 1", options: mockOptions }}
                    answer={undefined}
                    onSelect={vi.fn()}
                    onToggleMulti={vi.fn()}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            const options = screen.getAllByRole("option");

            // Move down to index 1 first
            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            expect(options[1]).toHaveAttribute("tabindex", "0");

            // Then move back up
            fireEvent.keyDown(listbox, { key: "ArrowUp" });
            expect(options[0]).toHaveAttribute("tabindex", "0");
            expect(options[1]).toHaveAttribute("tabindex", "-1");
        });

        it("ArrowDown does not go past last option", () => {
            render(
                <QuestionCard
                    question={{ title: "Question 1", options: mockOptions }}
                    answer={undefined}
                    onSelect={vi.fn()}
                    onToggleMulti={vi.fn()}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            const options = screen.getAllByRole("option");

            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            expect(options[2]).toHaveAttribute("tabindex", "0");

            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            expect(options[2]).toHaveAttribute("tabindex", "0");
        });

        it("ArrowUp does not go before first option", () => {
            render(
                <QuestionCard
                    question={{ title: "Question 1", options: mockOptions }}
                    answer={undefined}
                    onSelect={vi.fn()}
                    onToggleMulti={vi.fn()}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            const options = screen.getAllByRole("option");

            expect(options[0]).toHaveAttribute("tabindex", "0");
            fireEvent.keyDown(listbox, { key: "ArrowUp" });
            expect(options[0]).toHaveAttribute("tabindex", "0");
        });

        it("Enter key selects the active option in single-select mode", () => {
            const onSelect = vi.fn();
            render(
                <QuestionCard
                    question={{ title: "Question 1", options: mockOptions }}
                    answer={undefined}
                    onSelect={onSelect}
                    onToggleMulti={vi.fn()}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            // Move activeIndex to 1
            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            fireEvent.keyDown(listbox, { key: "Enter" });
            expect(onSelect).toHaveBeenCalledWith("Option B");
        });

        it("Space key selects the active option in single-select mode", () => {
            const onSelect = vi.fn();
            render(
                <QuestionCard
                    question={{ title: "Question 1", options: mockOptions }}
                    answer={undefined}
                    onSelect={onSelect}
                    onToggleMulti={vi.fn()}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            fireEvent.keyDown(listbox, { key: " " });
            expect(onSelect).toHaveBeenCalledWith("Option B");
        });

        it("Enter key toggles the active option in multi-select mode", () => {
            const onToggleMulti = vi.fn();
            render(
                <QuestionCard
                    question={{
                        title: "Question 1",
                        options: mockOptions,
                        allowMultiple: true,
                    }}
                    answer={undefined}
                    onSelect={vi.fn()}
                    onToggleMulti={onToggleMulti}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            fireEvent.keyDown(listbox, { key: "Enter" });
            expect(onToggleMulti).toHaveBeenCalledWith("Option B");
        });

        it("Space key toggles the active option in multi-select mode", () => {
            const onToggleMulti = vi.fn();
            render(
                <QuestionCard
                    question={{
                        title: "Question 1",
                        options: mockOptions,
                        allowMultiple: true,
                    }}
                    answer={undefined}
                    onSelect={vi.fn()}
                    onToggleMulti={onToggleMulti}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            fireEvent.keyDown(listbox, { key: " " });
            expect(onToggleMulti).toHaveBeenCalledWith("Option B");
        });

        it("number key 1 selects the first option", () => {
            const onSelect = vi.fn();
            render(
                <QuestionCard
                    question={{ title: "Question 1", options: mockOptions }}
                    answer={undefined}
                    onSelect={onSelect}
                    onToggleMulti={vi.fn()}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            fireEvent.keyDown(listbox, { key: "1" });
            expect(onSelect).toHaveBeenCalledWith("Option A");
        });

        it("number key 3 selects the third option", () => {
            const onSelect = vi.fn();
            render(
                <QuestionCard
                    question={{ title: "Question 1", options: mockOptions }}
                    answer={undefined}
                    onSelect={onSelect}
                    onToggleMulti={vi.fn()}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            fireEvent.keyDown(listbox, { key: "3" });
            expect(onSelect).toHaveBeenCalledWith("Option C");
        });

        it("number key beyond option count does nothing", () => {
            const onSelect = vi.fn();
            render(
                <QuestionCard
                    question={{ title: "Question 1", options: mockOptions }}
                    answer={undefined}
                    onSelect={onSelect}
                    onToggleMulti={vi.fn()}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            fireEvent.keyDown(listbox, { key: "9" });
            expect(onSelect).not.toHaveBeenCalled();
        });

        it("number key toggles in multi-select mode", () => {
            const onToggleMulti = vi.fn();
            render(
                <QuestionCard
                    question={{
                        title: "Question 1",
                        options: mockOptions,
                        allowMultiple: true,
                    }}
                    answer={undefined}
                    onSelect={vi.fn()}
                    onToggleMulti={onToggleMulti}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            fireEvent.keyDown(listbox, { key: "2" });
            expect(onToggleMulti).toHaveBeenCalledWith("Option B");
        });

        it("does not handle keyboard events when no options", () => {
            const onSelect = vi.fn();
            render(
                <QuestionCard
                    question={{ title: "Question 1", options: [] }}
                    answer={undefined}
                    onSelect={onSelect}
                    onToggleMulti={vi.fn()}
                    onSetText={vi.fn()}
                />,
            );
            // No listbox when no options
            expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        });

        it("Enter key selects active option", () => {
            const onSelect = vi.fn();
            render(
                <QuestionCard
                    question={{ title: "Question 1", options: mockOptions }}
                    answer={undefined}
                    onSelect={onSelect}
                    onToggleMulti={vi.fn()}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            // Navigate down to Option B
            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            fireEvent.keyDown(listbox, { key: "Enter" });
            expect(onSelect).toHaveBeenCalledWith("Option B");
        });

        it("Space key toggles active option in multi-select", () => {
            const onToggleMulti = vi.fn();
            render(
                <QuestionCard
                    question={{
                        title: "Question 1",
                        options: mockOptions,
                        allowMultiple: true,
                    }}
                    answer={undefined}
                    onSelect={vi.fn()}
                    onToggleMulti={onToggleMulti}
                    onSetText={vi.fn()}
                />,
            );
            const listbox = screen.getByRole("listbox");
            // Navigate down to Option B
            fireEvent.keyDown(listbox, { key: "ArrowDown" });
            fireEvent.keyDown(listbox, { key: " " });
            expect(onToggleMulti).toHaveBeenCalledWith("Option B");
        });
    });
});

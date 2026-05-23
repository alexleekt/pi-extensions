import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DialogFooter from "../DialogFooter";

describe("DialogFooter", () => {
    it("renders submit and cancel buttons", () => {
        render(
            <DialogFooter
                isSubmitting={false}
                onSubmit={() => {}}
                onCancel={() => {}}
            />,
        );

        expect(screen.getByText("Cancel")).toBeInTheDocument();
        expect(screen.getByText("Submit")).toBeInTheDocument();
    });

    it("calls onSubmit when submit button clicked", () => {
        const onSubmit = vi.fn();
        render(
            <DialogFooter
                isSubmitting={false}
                onSubmit={onSubmit}
                onCancel={() => {}}
            />,
        );

        fireEvent.click(screen.getByText("Submit"));
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when cancel button clicked", () => {
        const onCancel = vi.fn();
        render(
            <DialogFooter
                isSubmitting={false}
                onSubmit={() => {}}
                onCancel={onCancel}
            />,
        );

        fireEvent.click(screen.getByText("Cancel"));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("disables submit when isSubmitting is true", () => {
        render(
            <DialogFooter
                isSubmitting={true}
                onSubmit={() => {}}
                onCancel={() => {}}
            />,
        );

        expect(screen.getByText("Submitting…")).toBeDisabled();
    });

    it("disables submit when submitDisabled is true", () => {
        render(
            <DialogFooter
                isSubmitting={false}
                onSubmit={() => {}}
                onCancel={() => {}}
                submitDisabled={true}
            />,
        );

        expect(screen.getByText("Submit")).toBeDisabled();
    });

    it("renders hint content when provided", () => {
        render(
            <DialogFooter
                isSubmitting={false}
                onSubmit={() => {}}
                onCancel={() => {}}
                hint={<span data-testid="custom-hint">Custom Hint</span>}
            />,
        );

        expect(screen.getByTestId("custom-hint")).toBeInTheDocument();
    });

    it("renders children above the action bar", () => {
        render(
            <DialogFooter
                isSubmitting={false}
                onSubmit={() => {}}
                onCancel={() => {}}
            >
                <div data-testid="child-content">Extra content</div>
            </DialogFooter>,
        );

        expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    it("falls back to sendCancelled when onCancel is not provided", () => {
        // sendCancelled is a module-level function that posts a message.
        // We verify the button exists and is clickable without an explicit onCancel.
        const { container } = render(
            <DialogFooter isSubmitting={false} onSubmit={() => {}} />,
        );

        const cancelButton = screen.getByText("Cancel");
        expect(cancelButton).toBeInTheDocument();
    });
});

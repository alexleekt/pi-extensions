import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CancelConfirmModal from "../CancelConfirmModal";

describe("CancelConfirmModal", () => {
    it("does not render when isOpen is false", () => {
        render(
            <CancelConfirmModal
                isOpen={false}
                onStay={vi.fn()}
                onDiscard={vi.fn()}
            />,
        );
        expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    });

    it("renders when isOpen is true", () => {
        render(
            <CancelConfirmModal
                isOpen={true}
                onStay={vi.fn()}
                onDiscard={vi.fn()}
            />,
        );
        expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
        expect(screen.getByText("Stay")).toBeInTheDocument();
        expect(screen.getByText("Discard")).toBeInTheDocument();
    });

    it("calls onStay when Stay button is clicked", () => {
        const onStay = vi.fn();
        render(
            <CancelConfirmModal
                isOpen={true}
                onStay={onStay}
                onDiscard={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByText("Stay"));
        expect(onStay).toHaveBeenCalledTimes(1);
    });

    it("calls onDiscard when Discard button is clicked", () => {
        const onDiscard = vi.fn();
        render(
            <CancelConfirmModal
                isOpen={true}
                onStay={vi.fn()}
                onDiscard={onDiscard}
            />,
        );
        fireEvent.click(screen.getByText("Discard"));
        expect(onDiscard).toHaveBeenCalledTimes(1);
    });

    it("calls onStay when backdrop is clicked", () => {
        const onStay = vi.fn();
        render(
            <CancelConfirmModal
                isOpen={true}
                onStay={onStay}
                onDiscard={vi.fn()}
            />,
        );
        const backdrop = screen.getByText("Unsaved changes").closest("[role='dialog']") as HTMLElement;
        fireEvent.click(backdrop);
        expect(onStay).toHaveBeenCalledTimes(1);
    });

    it("does not call onStay when modal content is clicked", () => {
        const onStay = vi.fn();
        render(
            <CancelConfirmModal
                isOpen={true}
                onStay={onStay}
                onDiscard={vi.fn()}
            />,
        );
        const content = screen.getByText("Unsaved changes").closest("div[class*='bg-card']") as HTMLElement;
        fireEvent.click(content);
        expect(onStay).not.toHaveBeenCalled();
    });

    it("has correct ARIA attributes", () => {
        render(
            <CancelConfirmModal
                isOpen={true}
                onStay={vi.fn()}
                onDiscard={vi.fn()}
            />,
        );
        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog).toHaveAttribute("aria-labelledby", "cancel-confirm-title");
        expect(dialog).toHaveAttribute("aria-describedby", "cancel-confirm-desc");
    });

    it("focuses Stay button when modal opens", () => {
        render(
            <CancelConfirmModal
                isOpen={true}
                onStay={vi.fn()}
                onDiscard={vi.fn()}
            />,
        );
        const stayButton = screen.getByText("Stay");
        expect(document.activeElement).toBe(stayButton);
    });

    it("Tab key cycles focus from Stay button to Discard button", () => {
        render(
            <CancelConfirmModal
                isOpen={true}
                onStay={vi.fn()}
                onDiscard={vi.fn()}
            />,
        );
        const stayButton = screen.getByText("Stay");
        const discardButton = screen.getByText("Discard");
        expect(document.activeElement).toBe(stayButton);
        fireEvent.keyDown(document, { key: "Tab" });
        expect(document.activeElement).toBe(discardButton);
    });

    it("Shift+Tab cycles focus from Discard button back to Stay button", () => {
        render(
            <CancelConfirmModal
                isOpen={true}
                onStay={vi.fn()}
                onDiscard={vi.fn()}
            />,
        );
        const stayButton = screen.getByText("Stay");
        const discardButton = screen.getByText("Discard");
        discardButton.focus();
        expect(document.activeElement).toBe(discardButton);
        fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
        expect(document.activeElement).toBe(stayButton);
    });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBaseDialog } from "../useBaseDialog";
import { WithFooterProvider } from "../../test-helpers";

const mockSendCancelled = vi.fn();

vi.mock("../../util/glimpse", () => ({
    sendCancelled: () => mockSendCancelled(),
}));

vi.mock("../useDialogKeys", () => ({
    useDialogKeys: () => {},
}));

function wrapper({ children }: { children: React.ReactNode }) {
    return <WithFooterProvider>{children}</WithFooterProvider>;
}

const defaultPayload = {
    type: "single-select" as const,
    question: "Test?",
    options: [],
    allowMultiple: false,
    allowFreeform: true,
    allowComment: false,
};

describe("useBaseDialog", () => {
    beforeEach(() => {
        mockSendCancelled.mockClear();
    });

    it("returns isSubmitting false initially", () => {
        const { result } = renderHook(
            () =>
                useBaseDialog({
                    payload: defaultPayload,
                    isDirty: false,
                    onSubmit: vi.fn(),
                }),
            { wrapper },
        );
        expect(result.current.isSubmitting).toBe(false);
        expect(result.current.showCancelConfirm).toBe(false);
    });

    it("handleSubmit sets isSubmitting=true before calling onSubmit", () => {
        const onSubmit = vi.fn();
        const { result } = renderHook(
            () =>
                useBaseDialog({
                    payload: defaultPayload,
                    isDirty: false,
                    onSubmit,
                }),
            { wrapper },
        );
        result.current.handleSubmit();
        expect(result.current.isSubmitting).toBe(true);
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("handleSubmit catches errors and resets isSubmitting to false", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const onSubmit = vi.fn(() => {
            throw new Error("Submit error");
        });
        const { result } = renderHook(
            () =>
                useBaseDialog({
                    payload: defaultPayload,
                    isDirty: false,
                    onSubmit,
                }),
            { wrapper },
        );
        result.current.handleSubmit();
        expect(result.current.isSubmitting).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
            "[pi-ask-user-glimpse] Submit failed:",
            expect.any(Error),
        );
        consoleSpy.mockRestore();
    });

    it("handleSubmit guards against double-submit via hasSent ref", () => {
        const onSubmit = vi.fn();
        const { result } = renderHook(
            () =>
                useBaseDialog({
                    payload: defaultPayload,
                    isDirty: false,
                    onSubmit,
                }),
            { wrapper },
        );
        result.current.handleSubmit();
        result.current.handleSubmit(); // second call should be blocked
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("handleCancel shows cancel-confirm when dirty", () => {
        const { result } = renderHook(
            () =>
                useBaseDialog({
                    payload: defaultPayload,
                    isDirty: true,
                    onSubmit: vi.fn(),
                }),
            { wrapper },
        );
        result.current.handleCancel();
        expect(result.current.showCancelConfirm).toBe(true);
        expect(mockSendCancelled).not.toHaveBeenCalled();
    });

    it("handleCancel sends cancelled directly when not dirty", () => {
        const { result } = renderHook(
            () =>
                useBaseDialog({
                    payload: defaultPayload,
                    isDirty: false,
                    onSubmit: vi.fn(),
                }),
            { wrapper },
        );
        result.current.handleCancel();
        expect(mockSendCancelled).toHaveBeenCalledTimes(1);
        expect(result.current.showCancelConfirm).toBe(false);
    });

    it("handleCancel returns early when isSubmitting is true", () => {
        const onSubmit = vi.fn();
        const { result } = renderHook(
            () =>
                useBaseDialog({
                    payload: defaultPayload,
                    isDirty: true,
                    onSubmit,
                }),
            { wrapper },
        );
        result.current.handleSubmit(); // sets isSubmitting = true
        expect(result.current.isSubmitting).toBe(true);

        result.current.handleCancel();
        expect(result.current.showCancelConfirm).toBe(false);
        expect(mockSendCancelled).not.toHaveBeenCalled();
    });

    it("handleDiscard sets hasSent ref and calls sendCancelled", () => {
        const { result } = renderHook(
            () =>
                useBaseDialog({
                    payload: defaultPayload,
                    isDirty: true,
                    onSubmit: vi.fn(),
                }),
            { wrapper },
        );
        result.current.handleDiscard();
        expect(mockSendCancelled).toHaveBeenCalledTimes(1);
        expect(result.current.showCancelConfirm).toBe(false);
    });

    it("handleDiscard guards against double-cancel via hasSent ref", () => {
        const { result } = renderHook(
            () =>
                useBaseDialog({
                    payload: defaultPayload,
                    isDirty: true,
                    onSubmit: vi.fn(),
                }),
            { wrapper },
        );
        result.current.handleDiscard();
        result.current.handleDiscard(); // second call should be blocked
        expect(mockSendCancelled).toHaveBeenCalledTimes(1);
    });

    it("handleSubmit after handleDiscard is blocked by hasSent ref", () => {
        const onSubmit = vi.fn();
        const { result } = renderHook(
            () =>
                useBaseDialog({
                    payload: defaultPayload,
                    isDirty: true,
                    onSubmit,
                }),
            { wrapper },
        );
        result.current.handleDiscard();
        result.current.handleSubmit();
        expect(onSubmit).not.toHaveBeenCalled();
    });
});

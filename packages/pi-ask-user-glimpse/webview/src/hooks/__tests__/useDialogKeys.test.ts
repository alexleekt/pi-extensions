import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDialogKeys } from "../useDialogKeys";

const mockSendCancelled = vi.fn();

vi.mock("../../util/glimpse", () => ({
    sendCancelled: () => mockSendCancelled(),
}));

function fireWindowKeyDown(key: string, options: { ctrlKey?: boolean; metaKey?: boolean; target?: EventTarget } = {}) {
    const target = options.target ?? document.body;
    const event = new KeyboardEvent("keydown", {
        key,
        ctrlKey: options.ctrlKey ?? false,
        metaKey: options.metaKey ?? false,
        bubbles: true,
    });
    Object.defineProperty(event, "target", { value: target, enumerable: true });
    window.dispatchEvent(event);
}

describe("useDialogKeys", () => {
    beforeEach(() => {
        mockSendCancelled.mockClear();
    });

    it("Cmd+Enter calls onSubmit when not disabled", () => {
        const onSubmit = vi.fn();
        renderHook(() =>
            useDialogKeys({
                onSubmit,
                isSubmitting: false,
            }),
        );
        fireWindowKeyDown("Enter", { metaKey: true });
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("Ctrl+Enter calls onSubmit when not disabled", () => {
        const onSubmit = vi.fn();
        renderHook(() =>
            useDialogKeys({
                onSubmit,
                isSubmitting: false,
            }),
        );
        fireWindowKeyDown("Enter", { ctrlKey: true });
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("plain Enter does not call onSubmit (handled by component)", () => {
        const onSubmit = vi.fn();
        renderHook(() =>
            useDialogKeys({
                onSubmit,
                isSubmitting: false,
            }),
        );
        fireWindowKeyDown("Enter");
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("Escape key calls onCancel when provided", () => {
        const onCancel = vi.fn();
        renderHook(() =>
            useDialogKeys({
                onSubmit: vi.fn(),
                isSubmitting: false,
                onCancel,
            }),
        );
        fireWindowKeyDown("Escape");
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(mockSendCancelled).not.toHaveBeenCalled();
    });

    it("Escape key calls sendCancelled when onCancel is not provided", () => {
        renderHook(() =>
            useDialogKeys({
                onSubmit: vi.fn(),
                isSubmitting: false,
            }),
        );
        fireWindowKeyDown("Escape");
        expect(mockSendCancelled).toHaveBeenCalledTimes(1);
    });

    it("submitDisabled=true blocks Enter from calling onSubmit", () => {
        const onSubmit = vi.fn();
        renderHook(() =>
            useDialogKeys({
                onSubmit,
                isSubmitting: false,
                submitDisabled: true,
            }),
        );
        fireWindowKeyDown("Enter");
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("submitDisabled=true blocks Cmd+Enter from calling onSubmit", () => {
        const onSubmit = vi.fn();
        renderHook(() =>
            useDialogKeys({
                onSubmit,
                isSubmitting: false,
                submitDisabled: true,
            }),
        );
        fireWindowKeyDown("Enter", { metaKey: true });
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("showCancelConfirm=true blocks Enter from calling onSubmit", () => {
        const onSubmit = vi.fn();
        renderHook(() =>
            useDialogKeys({
                onSubmit,
                isSubmitting: false,
                showCancelConfirm: true,
            }),
        );
        fireWindowKeyDown("Enter");
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("showCancelConfirm=true blocks Escape from calling onCancel", () => {
        const onCancel = vi.fn();
        renderHook(() =>
            useDialogKeys({
                onSubmit: vi.fn(),
                isSubmitting: false,
                onCancel,
                showCancelConfirm: true,
            }),
        );
        fireWindowKeyDown("Escape");
        expect(onCancel).not.toHaveBeenCalled();
        expect(mockSendCancelled).not.toHaveBeenCalled();
    });

    it("isSubmitting=true blocks Enter from calling onSubmit", () => {
        const onSubmit = vi.fn();
        renderHook(() =>
            useDialogKeys({
                onSubmit,
                isSubmitting: true,
            }),
        );
        fireWindowKeyDown("Enter");
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("isSubmitting=true blocks Cmd+Enter from calling onSubmit", () => {
        const onSubmit = vi.fn();
        renderHook(() =>
            useDialogKeys({
                onSubmit,
                isSubmitting: true,
            }),
        );
        fireWindowKeyDown("Enter", { metaKey: true });
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("Tab key does nothing", () => {
        const onSubmit = vi.fn();
        const onCancel = vi.fn();
        renderHook(() =>
            useDialogKeys({
                onSubmit,
                isSubmitting: false,
                onCancel,
            }),
        );
        fireWindowKeyDown("Tab");
        expect(onSubmit).not.toHaveBeenCalled();
        expect(onCancel).not.toHaveBeenCalled();
    });

    it("Escape blurs textarea when focused instead of cancelling", () => {
        const onCancel = vi.fn();
        const textarea = document.createElement("textarea");
        document.body.appendChild(textarea);
        textarea.focus();

        renderHook(() =>
            useDialogKeys({
                onSubmit: vi.fn(),
                isSubmitting: false,
                onCancel,
            }),
        );
        fireWindowKeyDown("Escape", { target: textarea });
        expect(document.activeElement).not.toBe(textarea);
        expect(onCancel).not.toHaveBeenCalled();

        document.body.removeChild(textarea);
    });

    it("Escape calls onCloseComment when isCommentOpen is true", () => {
        const onCloseComment = vi.fn();
        renderHook(() =>
            useDialogKeys({
                onSubmit: vi.fn(),
                isSubmitting: false,
                isCommentOpen: true,
                onCloseComment,
            }),
        );
        fireWindowKeyDown("Escape");
        expect(onCloseComment).toHaveBeenCalledTimes(1);
        expect(mockSendCancelled).not.toHaveBeenCalled();
    });

    it("ignores events when target is inside data-overlay element", () => {
        const onSubmit = vi.fn();
        const onCancel = vi.fn();
        const overlay = document.createElement("div");
        overlay.setAttribute("data-overlay", "true");
        const button = document.createElement("button");
        overlay.appendChild(button);
        document.body.appendChild(overlay);

        renderHook(() =>
            useDialogKeys({
                onSubmit,
                isSubmitting: false,
                onCancel,
            }),
        );
        fireWindowKeyDown("Enter", { target: button });
        fireWindowKeyDown("Escape", { target: button });
        expect(onSubmit).not.toHaveBeenCalled();
        expect(onCancel).not.toHaveBeenCalled();

        document.body.removeChild(overlay);
    });

    it("Enter in input does not call onSubmit when allowSubmitInInput is false", () => {
        const onSubmit = vi.fn();
        const input = document.createElement("input");
        document.body.appendChild(input);
        input.focus();

        renderHook(() =>
            useDialogKeys({
                onSubmit,
                isSubmitting: false,
                allowSubmitInInput: false,
            }),
        );
        fireWindowKeyDown("Enter", { target: input });
        expect(onSubmit).not.toHaveBeenCalled();

        document.body.removeChild(input);
    });

    it("Cmd+Enter in input is blocked when allowSubmitInInput is false", () => {
        const onSubmit = vi.fn();
        const input = document.createElement("input");
        document.body.appendChild(input);
        input.focus();

        renderHook(() =>
            useDialogKeys({
                onSubmit,
                isSubmitting: false,
                allowSubmitInInput: false,
            }),
        );
        fireWindowKeyDown("Enter", { metaKey: true, target: input });
        expect(onSubmit).not.toHaveBeenCalled();

        document.body.removeChild(input);
    });
});

import { useCallback, useEffect, useRef } from "react";
import { sendCancelled } from "../util/glimpse";

interface UseDialogKeysOptions {
    /** Called when user presses Escape (after optional comment-close check). */
    onCancel?: () => void;
    /** Called when user presses Cmd/Ctrl+Enter. Guarded by isSubmitting. */
    onSubmit: () => void;
    /** Whether a submission is already in flight. */
    isSubmitting: boolean;
    /** If true, Escape closes the comment instead of cancelling the dialog. */
    isCommentOpen?: boolean;
    /** Called when Escape should close a comment instead of cancelling. */
    onCloseComment?: () => void;
    /** If true, Cmd+Enter is allowed even when focused in an input/textarea. */
    allowSubmitInInput?: boolean;
    /** If true, keyboard submit is disabled (e.g. nothing selected). */
    submitDisabled?: boolean;
    /** If true, a cancel-confirm modal is open — block all keyboard actions. */
    showCancelConfirm?: boolean;
}

/**
 * Shared global keydown handler for all ask-user dialog types.
 *
 * Provides stable listener via stateRef so the effect only registers once.
 */
export function useDialogKeys(options: UseDialogKeysOptions) {
    const {
        onCancel,
        onSubmit,
        isSubmitting,
        isCommentOpen = false,
        onCloseComment,
        allowSubmitInInput = true,
        submitDisabled = false,
        showCancelConfirm = false,
    } = options;

    const stateRef = useRef({
        isSubmitting,
        isCommentOpen,
        onCancel,
        onSubmit,
        onCloseComment,
        allowSubmitInInput,
        submitDisabled,
        showCancelConfirm,
    });

    stateRef.current = {
        isSubmitting,
        isCommentOpen,
        onCancel,
        onSubmit,
        onCloseComment,
        allowSubmitInInput,
        submitDisabled,
        showCancelConfirm,
    };

    /** Synchronous lock prevents double-submit between event loop ticks. */
    const submittingLock = useRef(false);

    useEffect(() => {
        if (!isSubmitting) submittingLock.current = false;
    }, [isSubmitting]);

    const stableSubmit = useCallback(() => {
        if (submittingLock.current) return;
        submittingLock.current = true;
        const s = stateRef.current;
        if (s.isSubmitting || s.submitDisabled || s.showCancelConfirm) return;
        s.onSubmit();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const s = stateRef.current;
            const target = e.target as HTMLElement;
            const isInInput =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement;

            if (e.key === "Escape") {
                // If a cancel-confirm modal is open, let the modal handle Escape
                if (s.showCancelConfirm) {
                    return;
                }
                // If a textarea is focused, blur it first (don't cancel yet)
                if (target instanceof HTMLTextAreaElement) {
                    e.preventDefault();
                    target.blur();
                    return;
                }
                if (s.isCommentOpen && s.onCloseComment) {
                    e.preventDefault();
                    s.onCloseComment();
                    return;
                }
                if (s.onCancel) {
                    s.onCancel();
                } else {
                    sendCancelled();
                }
                return;
            }

            if (e.key === "Tab") return;

            // Ctrl/Cmd+Enter to submit
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                if (isInInput && !s.allowSubmitInInput) return;
                e.preventDefault();
                stableSubmit();
                return;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [stableSubmit]);
}

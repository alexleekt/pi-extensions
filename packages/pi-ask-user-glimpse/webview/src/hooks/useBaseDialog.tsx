import { useCallback, useMemo, useRef, useState } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { sendCancelled } from "../util/glimpse";
import { useDialogKeys } from "./useDialogKeys";
import DialogFooter from "../components/DialogFooter";
import GlobalKeyboardHint from "../components/GlobalKeyboardHint";
import { useFooterPortal } from "../components/FooterContext";

interface UseBaseDialogOptions {
    payload: AskUserPayload;
    isDirty: boolean;
    onSubmit: () => void;
    isCommentOpen?: boolean;
    onCloseComment?: () => void;
    submitDisabled?: boolean;
}

interface UseBaseDialogReturn {
    isSubmitting: boolean;
    showCancelConfirm: boolean;
    setShowCancelConfirm: (v: boolean) => void;
    handleCancel: () => void;
    handleDiscard: () => void;
    handleSubmit: () => void;
}

export function useBaseDialog({
    payload,
    isDirty,
    onSubmit,
    isCommentOpen = false,
    onCloseComment,
    submitDisabled = false,
}: UseBaseDialogOptions): UseBaseDialogReturn {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    /** Synchronous guard — prevents any double-send (submit or cancel) in the same event loop tick.
     *  React state is batched and async; a ref is the only reliable guard for rapid events. */
    const hasSent = useRef(false);

    const handleCancel = useCallback(() => {
        if (hasSent.current || isSubmitting) return;
        if (isDirty) {
            setShowCancelConfirm(true);
            return;
        }
        hasSent.current = true;
        sendCancelled();
    }, [isDirty, isSubmitting]);

    const handleDiscard = useCallback(() => {
        if (hasSent.current) return;
        hasSent.current = true;
        setShowCancelConfirm(false);
        sendCancelled();
    }, []);

    const handleSubmit = useCallback(() => {
        if (hasSent.current) return;
        hasSent.current = true;
        setIsSubmitting(true);
        try {
            onSubmit();
        } catch (err) {
            console.error("[pi-ask-user-glimpse] Submit failed:", err);
            setIsSubmitting(false);
            hasSent.current = false;
        }
    }, [onSubmit]);

    useDialogKeys({
        onSubmit: handleSubmit,
        onCancel: handleCancel,
        isSubmitting,
        isCommentOpen,
        onCloseComment,
        submitDisabled,
        showCancelConfirm,
    });

    /* Render footer via portal so it spans full window width beneath both panels. */
    const footer = useMemo(
        () => (
            <DialogFooter
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                hint={<GlobalKeyboardHint payload={payload} />}
                submitDisabled={submitDisabled}
            />
        ),
        [isSubmitting, handleSubmit, handleCancel, payload, submitDisabled],
    );
    useFooterPortal(footer);

    return {
        isSubmitting,
        showCancelConfirm,
        setShowCancelConfirm,
        handleCancel,
        handleDiscard,
        handleSubmit,
    };
}

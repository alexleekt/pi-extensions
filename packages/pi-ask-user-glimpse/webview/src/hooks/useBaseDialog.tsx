import { useCallback, useMemo, useState } from "react";
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
    setIsSubmitting: (v: boolean) => void;
    showCancelConfirm: boolean;
    setShowCancelConfirm: (v: boolean) => void;
    handleCancel: () => void;
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

    const handleCancel = useCallback(() => {
        if (isDirty) {
            setShowCancelConfirm(true);
            return;
        }
        sendCancelled();
    }, [isDirty]);

    const handleSubmit = useCallback(() => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        onSubmit();
    }, [isSubmitting, onSubmit]);

    useDialogKeys({
        onSubmit: handleSubmit,
        onCancel: handleCancel,
        isSubmitting,
        isCommentOpen,
        onCloseComment,
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
        setIsSubmitting,
        showCancelConfirm,
        setShowCancelConfirm,
        handleCancel,
        handleSubmit,
    };
}

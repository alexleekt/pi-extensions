import { useCallback, useMemo, useState } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { sendCancelled, sendToGlimpse } from "../util/glimpse";
import { useDialogKeys } from "../hooks/useDialogKeys";
import CancelConfirmModal from "./CancelConfirmModal";
import DialogFooter from "./DialogFooter";
import { useFooterPortal } from "./FooterContext";
import GlobalKeyboardHint from "./GlobalKeyboardHint";

const MAX_FREEFORM_LENGTH = 2000;

interface FreeformProps {
    payload: AskUserPayload;
}

export default function Freeform({
    payload,
}: FreeformProps) {
    const [text, setText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    const handleSubmit = useCallback(() => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        sendToGlimpse({ kind: "freeform", text: text.trim() });
    }, [isSubmitting, text]);

    const isDirty = text.trim() !== "";

    const handleCancel = useCallback(() => {
        if (isDirty) {
            setShowCancelConfirm(true);
            return;
        }
        sendCancelled();
    }, [isDirty]);

    useDialogKeys({ onSubmit: handleSubmit, onCancel: handleCancel, isSubmitting });

    /* Render footer via portal so it spans full window width beneath both panels. */
    const footer = useMemo(
        () => (
            <DialogFooter
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                hint={<GlobalKeyboardHint payload={payload} />}
            />
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isSubmitting, handleSubmit, handleCancel, payload],
    );
    useFooterPortal(footer);

    return (
        <div className="flex h-full flex-col">
            <div className="flex-1 p-4">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type your answer…"
                    maxLength={MAX_FREEFORM_LENGTH}
                    className="h-full w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                />
            </div>

            <CancelConfirmModal
                isOpen={showCancelConfirm}
                onStay={() => setShowCancelConfirm(false)}
                onDiscard={() => {
                    setShowCancelConfirm(false);
                    sendCancelled();
                }}
            />
        </div>
    );
}

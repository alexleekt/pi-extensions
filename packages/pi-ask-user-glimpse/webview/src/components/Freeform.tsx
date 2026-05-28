import { useCallback, useMemo, useRef, useState } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { sendCancelled, sendToGlimpse } from "../util/glimpse";
import { useDialogKeys } from "../hooks/useDialogKeys";
import AdditionalComments from "./AdditionalComments";
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
    const [additionalComments, setAdditionalComments] = useState("");
    const commentsRef = useRef<HTMLTextAreaElement | null>(null);

    const handleSubmit = useCallback(() => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        const result: Record<string, unknown> = {
            kind: "freeform",
            text: text.trim(),
        };
        if (additionalComments.trim())
            result.additionalComments = additionalComments.trim();
        sendToGlimpse(result);
    }, [isSubmitting, text, additionalComments]);

    const isDirty = text.trim() !== "" || additionalComments.trim() !== "";

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

            {/* Additional comments — stays in right panel above the full-width footer */}
            <div className="shrink-0 border-t border-border px-4 py-3">
                <AdditionalComments
                    ref={commentsRef}
                    value={additionalComments}
                    onChange={setAdditionalComments}
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

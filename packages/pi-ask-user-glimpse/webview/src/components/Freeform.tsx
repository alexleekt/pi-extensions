import { useCallback, useState } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { useBaseDialog } from "../hooks/useBaseDialog";
import { sendToGlimpse } from "../util/glimpse";
import AdditionalComments from "./AdditionalComments";
import CancelConfirmModal from "./CancelConfirmModal";
import MarkdownPreview from "./MarkdownPreview";

const MAX_FREEFORM_LENGTH = 2000;

interface FreeformProps {
    payload: AskUserPayload;
}

export default function Freeform({ payload }: FreeformProps) {
    const [text, setText] = useState("");
    const [additionalComments, setAdditionalComments] = useState("");

    const handleSubmit = useCallback(() => {
        const result: Record<string, unknown> = {
            kind: "freeform",
            text: text.trim(),
        };
        if (additionalComments.trim()) {
            result.additionalComments = additionalComments.trim();
        }
        sendToGlimpse(result);
    }, [text, additionalComments]);

    const isDirty = text.trim() !== "" || additionalComments.trim() !== "";
    const submitDisabled = payload.allowSkip === false && text.trim().length === 0;

    const {
        isSubmitting,
        showCancelConfirm,
        setShowCancelConfirm,
        handleCancel,
        handleStay,
        handleDiscard,
    } = useBaseDialog({
        payload,
        isDirty,
        onSubmit: handleSubmit,
        submitDisabled,
    });

    return (
        <div className="flex h-full flex-col">
            <div className="flex flex-1 flex-col gap-2 p-4 overflow-hidden">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type your answer…"
                    aria-label="Your answer"
                    maxLength={MAX_FREEFORM_LENGTH}
                    className="flex-1 w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                />
                <MarkdownPreview text={text} />
            </div>
            <div className="shrink-0 border-t border-border px-4 py-3">
                <AdditionalComments
                    value={additionalComments}
                    onChange={setAdditionalComments}
                />
            </div>

            <CancelConfirmModal
                isOpen={showCancelConfirm}
                onStay={handleStay}
                onDiscard={handleDiscard}
            />
        </div>
    );
}

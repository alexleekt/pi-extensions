import { useCallback, useState } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { useBaseDialog } from "../hooks/useBaseDialog";
import { sendToGlimpse } from "../util/glimpse";
import CancelConfirmModal from "./CancelConfirmModal";
import MarkdownPreview from "./MarkdownPreview";

const MAX_FREEFORM_LENGTH = 2000;

interface FreeformProps {
    payload: AskUserPayload;
}

export default function Freeform({
    payload,
}: FreeformProps) {
    const [text, setText] = useState("");

    const handleSubmit = useCallback(() => {
        const result: Record<string, unknown> = {
            kind: "freeform",
            text: text.trim(),
        };
        sendToGlimpse(result);
    }, [text]);

    const isDirty = text.trim() !== "";

    const { isSubmitting, showCancelConfirm, setShowCancelConfirm, handleCancel, handleDiscard } = useBaseDialog({
        payload,
        isDirty,
        onSubmit: handleSubmit,
    });

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
                <MarkdownPreview text={text} className="mt-2" />
            </div>

            <CancelConfirmModal
                isOpen={showCancelConfirm}
                onStay={() => setShowCancelConfirm(false)}
                onDiscard={handleDiscard}
            />
        </div>
    );
}

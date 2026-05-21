import { useCallback, useState } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { sendToGlimpse } from "../util/glimpse";
import { modKey } from "../util/platform";
import { useDialogKeys } from "../hooks/useDialogKeys";
import DialogFooter from "./DialogFooter";

const MAX_FREEFORM_LENGTH = 2000;

interface FreeformProps {
    payload: AskUserPayload;
}

export default function Freeform({
    payload,
}: FreeformProps) {
    const [text, setText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = useCallback(() => {
        if (isSubmitting) return;
        const trimmed = text.trim();
        if (!trimmed) return;
        setIsSubmitting(true);
        sendToGlimpse({ kind: "freeform", text: trimmed });
    }, [isSubmitting, text]);

    useDialogKeys({ onSubmit: handleSubmit, isSubmitting });

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

            <DialogFooter
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
                hint={`${text.length}/${MAX_FREEFORM_LENGTH} · ${modKey()}+Enter to submit`}
            />
        </div>
    );
}

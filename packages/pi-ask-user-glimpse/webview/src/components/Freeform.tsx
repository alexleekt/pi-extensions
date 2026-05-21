import { useEffect, useState } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { sendCancelled, sendToGlimpse } from "../util/glimpse";
import { modKey } from "../util/platform";

const MAX_FREEFORM_LENGTH = 2000;

interface FreeformProps {
    payload: AskUserPayload;
    showHeader?: boolean;
}

export default function Freeform({
    payload,
    showHeader = true,
}: FreeformProps) {
    const [text, setText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        sendToGlimpse({
            kind: "freeform",
            text: text.trim(),
        });
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                sendCancelled();
                return;
            }
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (text.trim()) {
                    handleSubmit();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [text, handleSubmit]);

    return (
        <div className="flex h-full flex-col">
            {showHeader && (
                <div className="shrink-0 border-b border-border p-4">
                    <h1 className="text-lg font-semibold">
                        {payload.question}
                    </h1>
                    {payload.context && (
                        <p className="mt-1 text-sm text-muted-foreground">
                            {payload.context}
                        </p>
                    )}
                </div>
            )}

            <div className="flex-1 p-4">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type your answer…"
                    maxLength={MAX_FREEFORM_LENGTH}
                    className="h-full w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                />
            </div>

            <div className="shrink-0 border-t border-border p-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                            {modKey()}+Enter to submit
                        </span>
                        <span className={`text-xs ${text.length > MAX_FREEFORM_LENGTH * 0.9 ? "text-destructive" : "text-muted-foreground"}`}>
                            {text.length}/{MAX_FREEFORM_LENGTH}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={sendCancelled}
                            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                            {isSubmitting ? "Submitting…" : "Submit"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

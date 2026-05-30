import { useCallback, useState } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { useBaseDialog } from "../hooks/useBaseDialog";
import { sendToGlimpse } from "../util/glimpse";
import CancelConfirmModal from "./CancelConfirmModal";
import { CommentIcon } from "./icons";
import MarkdownPreview from "./MarkdownPreview";

const MAX_FREEFORM_LENGTH = 2000;
const MAX_COMMENT_LENGTH = 1000;

interface FreeformProps {
    payload: AskUserPayload;
}

export default function Freeform({ payload }: FreeformProps) {
    const [text, setText] = useState("");
    const [comment, setComment] = useState("");
    const [showComment, setShowComment] = useState(false);

    const handleSubmit = useCallback(() => {
        const result: Record<string, unknown> = {
            kind: "freeform",
            text: text.trim(),
        };
        if (comment.trim()) {
            result.comment = comment.trim();
        }
        sendToGlimpse(result);
    }, [text, comment]);

    const isDirty = text.trim() !== "" || comment.trim() !== "";

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
        isCommentOpen: showComment,
        onCloseComment: () => setShowComment(false),
    });

    return (
        <div className="flex h-full flex-col">
            <div className="flex flex-1 flex-col gap-2 p-4 overflow-hidden">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type your answer…"
                    maxLength={MAX_FREEFORM_LENGTH}
                    className="flex-1 w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                />
                <MarkdownPreview text={text} />
            </div>

            {payload.allowComment && (
                <div className="shrink-0 px-4 py-3">
                    <button
                        type="button"
                        onClick={() => setShowComment((s) => !s)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-expanded={showComment}
                        aria-controls="freeform-comment-textarea"
                    >
                        <CommentIcon />
                        {showComment
                            ? "Hide comment"
                            : comment.trim()
                              ? "Edit comment"
                              : "Add comment"}
                    </button>
                    {showComment && (
                        <>
                            <textarea
                                id="freeform-comment-textarea"
                                aria-label="Additional comment"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Optional comment…"
                                maxLength={MAX_COMMENT_LENGTH}
                                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring resize-none"
                                rows={3}
                            />
                            <div className="mt-1 text-right text-xs text-muted-foreground">
                                {comment.length}/{MAX_COMMENT_LENGTH}
                            </div>
                            <MarkdownPreview text={comment} />
                        </>
                    )}
                </div>
            )}

            <CancelConfirmModal
                isOpen={showCancelConfirm}
                onStay={handleStay}
                onDiscard={handleDiscard}
            />
        </div>
    );
}

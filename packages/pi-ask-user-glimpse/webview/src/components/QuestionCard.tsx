import { useRef, useState } from "react";
import { CommentIcon } from "./icons";
import MarkdownPreview from "./MarkdownPreview";
import OptionCard from "./OptionCard";
import RichText from "./RichText";

interface QuestionOption {
    title: string;
    description?: string;
    recommended?: boolean;
}

interface Question {
    title: string;
    description?: string;
    options?: QuestionOption[];
    allowMultiple?: boolean;
}

interface QuestionCardProps {
    question: Question;
    answer: string | string[] | undefined;
    index: number;
    onSelect: (title: string) => void;
    onToggleMulti: (title: string) => void;
    onSetText: (text: string) => void;
    comment?: string;
    showComment?: boolean;
    onToggleComment?: () => void;
    onCommentChange?: (text: string) => void;
}

export default function QuestionCard({
    question,
    answer,
    index,
    onSelect,
    onToggleMulti,
    onSetText,
    comment = "",
    showComment = false,
    onToggleComment,
    onCommentChange,
}: QuestionCardProps) {
    const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
    const isAnswered = Array.isArray(answer)
        ? answer.length > 0
        : answer !== undefined && answer !== "";
    const isRequired = true; // questionnaire questions are always required for now

    return (
        <div className="border-b border-border last:border-b-0 py-4">
            <div className="mb-2 flex items-center gap-2">
                <RichText text={question.title} className="font-medium" />
                {isRequired && !isAnswered && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        Required
                    </span>
                )}
            </div>
            {question.description && (
                <RichText text={question.description} className="mb-3 text-sm text-muted-foreground" />
            )}

            {question.options && question.options.length > 0 ? (
                <div className="space-y-2">
                    {question.options.map((opt, optIdx) => {
                        const arr = Array.isArray(answer)
                            ? answer
                            : answer
                              ? [answer]
                              : [];
                        const isSelected = arr.includes(opt.title);
                        return (
                            <OptionCard
                                ref={(el) => {
                                    optionRefs.current[optIdx] = el;
                                }}
                                key={opt.title}
                                title={opt.title}
                                description={opt.description}
                                index={optIdx}
                                isSelected={isSelected}
                                isActive={false}
                                mode={question.allowMultiple ? "multi" : "single"}
                                onClick={() =>
                                    question.allowMultiple
                                        ? onToggleMulti(opt.title)
                                        : onSelect(opt.title)
                                }
                                recommended={opt.recommended}
                                tabIndex={optIdx === 0 ? 0 : -1}
                            />
                        );
                    })}
                </div>
            ) : (
                <div>
                    <textarea
                        placeholder="Your answer…"
                        value={(answer as string) ?? ""}
                        onChange={(e) => onSetText(e.target.value)}
                        maxLength={1000}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring resize-none"
                        rows={3}
                    />
                    <div className="mt-1 text-right text-xs text-muted-foreground">
                        {String(answer ?? "").length}/1000
                    </div>
                </div>
            )}

            {onToggleComment && onCommentChange && (
                <div className="mt-2">
                    <button
                        onClick={onToggleComment}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-expanded={showComment}
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
                                value={comment}
                                onChange={(e) => onCommentChange(e.target.value)}
                                placeholder="Optional comment…"
                                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring resize-none"
                                rows={3}
                            />
                            <MarkdownPreview text={comment} />
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

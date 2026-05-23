import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { useDialogKeys } from "../hooks/useDialogKeys";
import { sendCancelled, sendToGlimpse } from "../util/glimpse";
import { renderOptionText } from "../util/html";
import AdditionalComments from "./AdditionalComments";
import CancelConfirmModal from "./CancelConfirmModal";
import DialogFooter from "./DialogFooter";
import GlobalKeyboardHint from "./GlobalKeyboardHint";
import { CheckIcon, CommentIcon, isSelectAllOption, RadioIcon } from "./icons";

interface MultiSelectProps {
    payload: AskUserPayload;
}

export default function MultiSelect({ payload }: MultiSelectProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [comment, setComment] = useState("");
    const [showComment, setShowComment] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [additionalComments, setAdditionalComments] = useState("");
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const freeformRef = useRef<HTMLButtonElement | null>(null);
    const commentsRef = useRef<HTMLTextAreaElement | null>(null);

    const selectAllOption = useMemo(
        () => payload.options.find((opt) => isSelectAllOption(opt.title)),
        [payload.options],
    );

    const stateRef = useRef({
        selected: new Set<string>(),
        comment: "",
        showComment: false,
        additionalComments: "",
        activeIndex: -1,
        isSubmitting: false,
        options: payload.options,
        allowFreeform: payload.allowFreeform,
        selectAllOption: undefined as typeof selectAllOption,
    });
    stateRef.current = {
        selected,
        comment,
        showComment,
        additionalComments,
        activeIndex,
        isSubmitting,
        options: payload.options,
        allowFreeform: payload.allowFreeform,
        selectAllOption,
    };

    const handleFreeform = useCallback(() => {
        sendToGlimpse({ kind: "freeform", text: "" });
    }, []);

    const toggle = useCallback((title: string) => {
        const s = stateRef.current;
        if (s.selectAllOption && title === s.selectAllOption.title) {
            const regular = s.options
                .filter((opt) => !isSelectAllOption(opt.title))
                .map((opt) => opt.title);
            setSelected(new Set(regular));
            return;
        }
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            if (s.selectAllOption && next.has(s.selectAllOption.title))
                next.delete(s.selectAllOption.title);
            return next;
        });
    }, []);

    const handleSubmit = useCallback(() => {
        const s = stateRef.current;
        if (s.isSubmitting) return;
        const hasSelection = s.selected.size > 0;
        setIsSubmitting(true);
        if (!hasSelection && s.allowFreeform) {
            handleFreeform();
            return;
        }
        const result: Record<string, unknown> = {
            kind: "selection",
            selections: Array.from(s.selected),
        };
        if (s.showComment && s.comment.trim())
            result.comment = s.comment.trim();
        if (s.additionalComments.trim())
            result.additionalComments = s.additionalComments.trim();
        sendToGlimpse(result);
    }, [handleFreeform]);

    const isDirty =
        selected.size > 0 ||
        comment.trim() !== "" ||
        additionalComments.trim() !== "";

    const handleCancel = useCallback(() => {
        if (isDirty) {
            setShowCancelConfirm(true);
            return;
        }
        sendCancelled();
    }, [isDirty]);

    useDialogKeys({
        onSubmit: handleSubmit,
        onCancel: handleCancel,
        isSubmitting,
        isCommentOpen: showComment,
        onCloseComment: () => setShowComment(false),
    });

    useEffect(() => {
        const id = requestAnimationFrame(() => {
            optionRefs.current[0]?.focus();
            setActiveIndex(0);
        });
        return () => cancelAnimationFrame(id);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const s = stateRef.current;
            const target = e.target as HTMLElement;
            const isInInput =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement;

            if (e.key === "Escape") return; // handled by useDialogKeys
            if (e.key === "Tab") return; // browser handles zone navigation
            if (isInInput) return;
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) return; // handled by useDialogKeys

            // Number keys 1-9 to toggle options (without submitting)
            if (e.key >= "1" && e.key <= "9") {
                const idx = parseInt(e.key, 10) - 1;
                if (idx >= 0 && idx < s.options.length) {
                    toggle(s.options[idx].title);
                    setActiveIndex(idx);
                    optionRefs.current[idx]?.focus();
                    optionRefs.current[idx]?.scrollIntoView({
                        block: "nearest",
                    });
                }
                return;
            }

            // 0 to focus additional comments
            if (e.key === "0") {
                e.preventDefault();
                commentsRef.current?.focus();
                commentsRef.current?.scrollIntoView({ block: "nearest" });
                return;
            }

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = Math.min(prev + 1, s.options.length - 1);
                    optionRefs.current[next]?.focus();
                    optionRefs.current[next]?.scrollIntoView({
                        block: "nearest",
                    });
                    return next;
                });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = Math.max(prev - 1, 0);
                    optionRefs.current[next]?.focus();
                    optionRefs.current[next]?.scrollIntoView({
                        block: "nearest",
                    });
                    return next;
                });
            } else if (e.key === " " || e.key === "Spacebar") {
                e.preventDefault();
                if (s.activeIndex >= 0 && s.activeIndex < s.options.length)
                    toggle(s.options[s.activeIndex].title);
            } else if (e.key === "Enter") {
                e.preventDefault();
                const focusedEl = document.activeElement;
                const freeformFocused =
                    s.allowFreeform &&
                    focusedEl != null &&
                    (focusedEl === freeformRef.current ||
                        freeformRef.current?.contains(focusedEl));
                if (freeformFocused) {
                    setIsSubmitting(true);
                    handleFreeform();
                } else if (
                    s.activeIndex >= 0 &&
                    s.activeIndex < s.options.length
                ) {
                    toggle(s.options[s.activeIndex].title);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggle, handleFreeform]);

    return (
        <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-border p-4">
                {selected.size > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            {selected.size} selected
                        </div>
                        <button
                            onClick={() => setSelected(new Set())}
                            className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
                        >
                            Clear all
                        </button>
                    </div>
                )}
                {payload.options.length > 1 && (
                    <div className="mt-2 flex items-center gap-2">
                        <button
                            onClick={() => {
                                const allRegular = payload.options
                                    .filter(
                                        (opt) => !isSelectAllOption(opt.title),
                                    )
                                    .map((opt) => opt.title);
                                setSelected(new Set(allRegular));
                            }}
                            className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
                        >
                            Select all
                        </button>
                        <span className="text-xs text-muted-foreground">·</span>
                        <button
                            onClick={() => setSelected(new Set())}
                            className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
                        >
                            Select none
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div
                    className="space-y-2"
                    role="listbox"
                    aria-label="Options"
                    aria-multiselectable="true"
                >
                    {payload.options.length > 0 ? (
                        payload.options.map((opt, idx) => {
                            const isSelected = selected.has(opt.title);
                            const isSelectAll = isSelectAllOption(opt.title);
                            const titleHtml = renderOptionText(opt.title);
                            const descHtml = opt.description
                                ? renderOptionText(opt.description)
                                : null;
                            return (
                                <button
                                    ref={(el) => {
                                        optionRefs.current[idx] = el;
                                    }}
                                    key={opt.title}
                                    tabIndex={activeIndex === idx ? 0 : -1}
                                    onClick={() => toggle(opt.title)}
                                    role="option"
                                    aria-selected={isSelected}
                                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                                        isSelected
                                            ? "border-primary bg-primary/5"
                                            : "border-border bg-card hover:bg-accent"
                                    } ${activeIndex === idx ? "ring-2 ring-ring" : ""}`}
                                >
                                    {isSelectAll ? (
                                        <RadioIcon checked={isSelected} />
                                    ) : (
                                        <div
                                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                                                isSelected
                                                    ? "bg-primary text-primary-foreground"
                                                    : "border border-border"
                                            }`}
                                        >
                                            {isSelected && (
                                                <CheckIcon checked={true} />
                                            )}
                                        </div>
                                    )}
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                        {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="font-medium"
                                                dangerouslySetInnerHTML={{
                                                    __html: titleHtml,
                                                }}
                                            />
                                            {opt.recommended && (
                                                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                                    Recommended
                                                </span>
                                            )}
                                        </div>
                                        {descHtml && (
                                            <div
                                                className="mt-0.5 text-sm text-muted-foreground border-l-2 border-muted-foreground/30 pl-2.5"
                                                dangerouslySetInnerHTML={{
                                                    __html: descHtml,
                                                }}
                                            />
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                            No options available.
                            {payload.allowFreeform && (
                                <span>
                                    {" "}
                                    Use "My answer isn't listed above" below to
                                    submit your own.
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {payload.allowFreeform && (
                    <button
                        ref={freeformRef}
                        tabIndex={0}
                        onClick={handleFreeform}
                        className="mt-4 w-full rounded-lg border border-dashed border-border p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent"
                    >
                        My answer isn't listed above
                    </button>
                )}
            </div>

            <DialogFooter
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                hint={<GlobalKeyboardHint payload={payload} />}
                submitDisabled={
                    !payload.allowFreeform && selected.size === 0
                }
            >
                {payload.allowComment && (
                    <div className="mb-3">
                        <button
                            onClick={() => setShowComment((s) => !s)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Optional comment…"
                                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                                rows={3}
                            />
                        )}
                    </div>
                )}
                <AdditionalComments
                    ref={commentsRef}
                    value={additionalComments}
                    onChange={setAdditionalComments}
                />
            </DialogFooter>
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

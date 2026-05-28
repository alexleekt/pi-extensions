import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FREEFORM_OPTION_TITLE, type AskUserPayload } from "../../../shared/ask-user";
import { useBaseDialog } from "../hooks/useBaseDialog";
import { sendToGlimpse } from "../util/glimpse";
import CancelConfirmModal from "./CancelConfirmModal";
import { CheckIcon, CommentIcon, isSelectAllOption } from "./icons";
import MarkdownPreview from "./MarkdownPreview";
import OptionCard from "./OptionCard";

interface MultiSelectProps {
    payload: AskUserPayload;
}

export default function MultiSelect({ payload }: MultiSelectProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [comment, setComment] = useState("");
    const [showComment, setShowComment] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
    const freeformRef = useRef<HTMLButtonElement | null>(null);

    const hasFreeform = payload.allowFreeform;
    const maxIndex = hasFreeform ? payload.options.length : payload.options.length - 1;

    const selectAllOption = useMemo(
        () => payload.options.find((opt) => isSelectAllOption(opt.title)),
        [payload.options],
    );

    const stateRef = useRef({
        selected: new Set<string>(),
        comment: "",
        showComment: false,
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
        activeIndex,
        isSubmitting: false,
        options: payload.options,
        allowFreeform: payload.allowFreeform,
        selectAllOption,
    };

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

    const handleFreeform = useCallback(() => {
        toggle(FREEFORM_OPTION_TITLE);
        setActiveIndex(payload.options.length);
        freeformRef.current?.focus();
        freeformRef.current?.scrollIntoView({ block: "nearest" });
    }, [toggle, payload.options.length]);

    const handleSubmit = useCallback(() => {
        const s = stateRef.current;
        if (s.isSubmitting) return;

        if (s.selected.has(FREEFORM_OPTION_TITLE)) {
            const result: Record<string, unknown> = {
                kind: "freeform",
                text: "",
            };
            if (s.showComment && s.comment.trim())
                result.comment = s.comment.trim();
            sendToGlimpse(result);
            return;
        }

        const hasSelection = s.selected.size > 0;
        if (!hasSelection && s.allowFreeform) {
            const result: Record<string, unknown> = {
                kind: "freeform",
                text: "",
            };
            if (s.showComment && s.comment.trim())
                result.comment = s.comment.trim();
            sendToGlimpse(result);
            return;
        }
        const result: Record<string, unknown> = {
            kind: "selection",
            selections: Array.from(s.selected),
        };
        if (s.showComment && s.comment.trim())
            result.comment = s.comment.trim();
        sendToGlimpse(result);
    }, []);

    const isDirty = selected.size > 0 || comment.trim() !== "";

    const { isSubmitting, setIsSubmitting, showCancelConfirm, setShowCancelConfirm, handleCancel } = useBaseDialog({
        payload,
        isDirty,
        onSubmit: handleSubmit,
        isCommentOpen: showComment,
        onCloseComment: () => setShowComment(false),
        submitDisabled: !hasFreeform && selected.size === 0,
    });

    useEffect(() => {
        const id = requestAnimationFrame(() => {
            if (payload.options.length > 0) {
                optionRefs.current[0]?.focus();
                setActiveIndex(0);
            } else if (hasFreeform) {
                freeformRef.current?.focus();
                setActiveIndex(0);
            }
        });
        return () => cancelAnimationFrame(id);
    }, [hasFreeform, payload.options.length]);

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

            // Minus key to toggle freeform option (without submitting)
            if (e.key === "-" || e.key === "_") {
                if (s.allowFreeform) {
                    e.preventDefault();
                    toggle(FREEFORM_OPTION_TITLE);
                    setActiveIndex(s.options.length);
                    freeformRef.current?.focus();
                    freeformRef.current?.scrollIntoView({ block: "nearest" });
                }
                return;
            }

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = Math.min(prev + 1, maxIndex);
                    if (next < s.options.length) {
                        optionRefs.current[next]?.focus();
                        optionRefs.current[next]?.scrollIntoView({
                            block: "nearest",
                        });
                    } else if (s.allowFreeform && next === s.options.length) {
                        freeformRef.current?.focus();
                        freeformRef.current?.scrollIntoView({
                            block: "nearest",
                        });
                    }
                    return next;
                });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = Math.max(prev - 1, 0);
                    if (next < s.options.length) {
                        optionRefs.current[next]?.focus();
                        optionRefs.current[next]?.scrollIntoView({
                            block: "nearest",
                        });
                    } else if (s.allowFreeform && next === s.options.length) {
                        freeformRef.current?.focus();
                        freeformRef.current?.scrollIntoView({
                            block: "nearest",
                        });
                    }
                    return next;
                });
            } else if (e.key === " " || e.key === "Spacebar") {
                e.preventDefault();
                if (s.activeIndex >= 0 && s.activeIndex < s.options.length)
                    toggle(s.options[s.activeIndex].title);
                else if (s.allowFreeform && s.activeIndex === s.options.length)
                    toggle(FREEFORM_OPTION_TITLE);
            } else if (e.key === "Enter") {
                e.preventDefault();
                const focusedEl = document.activeElement;
                const freeformFocused =
                    s.allowFreeform &&
                    focusedEl != null &&
                    (focusedEl === freeformRef.current ||
                        freeformRef.current?.contains(focusedEl));
                if (freeformFocused) {
                    // Enter on freeform: only toggle, do not submit
                    toggle(FREEFORM_OPTION_TITLE);
                } else if (
                    s.activeIndex >= 0 &&
                    s.activeIndex < s.options.length
                ) {
                    toggle(s.options[s.activeIndex].title);
                } else if (s.allowFreeform && s.activeIndex === s.options.length) {
                    // Freeform active via navigation: just toggle
                    toggle(FREEFORM_OPTION_TITLE);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggle, maxIndex]);

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
                        payload.options.map((opt, idx) => (
                            <OptionCard
                                ref={(el) => {
                                    optionRefs.current[idx] = el;
                                }}
                                key={opt.title}
                                title={opt.title}
                                description={opt.description}
                                index={idx}
                                isSelected={selected.has(opt.title)}
                                isActive={activeIndex === idx}
                                mode="multi"
                                onClick={() => toggle(opt.title)}
                                recommended={opt.recommended}
                                tabIndex={activeIndex === idx ? 0 : -1}
                            />
                        ))
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

                {hasFreeform && (
                    <button
                        ref={freeformRef}
                        tabIndex={activeIndex === payload.options.length ? 0 : -1}
                        onClick={handleFreeform}
                        role="option"
                        aria-selected={selected.has(FREEFORM_OPTION_TITLE)}
                        className={`mt-4 flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                            selected.has(FREEFORM_OPTION_TITLE)
                                ? "border-primary bg-primary/5"
                                : "border-dashed border-border text-muted-foreground hover:bg-accent"
                        } ${activeIndex === payload.options.length ? "ring-2 ring-ring" : ""}`}
                    >
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                            selected.has(FREEFORM_OPTION_TITLE)
                                ? "bg-primary text-primary-foreground"
                                : "border border-border"
                        }`}>
                            {selected.has(FREEFORM_OPTION_TITLE) && <CheckIcon checked={true} />}
                        </div>
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                            -
                        </span>
                        <span className="font-medium">{FREEFORM_OPTION_TITLE}</span>
                    </button>
                )}
            </div>

            {/* Per-selection comment — stays in right panel above the full-width footer */}
            <div className="shrink-0 border-t border-border px-4 py-3">
                {payload.allowComment && (
                    <div>
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
                            <>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Optional comment…"
                                    className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                                    rows={3}
                                />
                                <MarkdownPreview text={comment} />
                            </>
                        )}
                    </div>
                )}
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FREEFORM_OPTION_TITLE, type AskUserPayload } from "../../../shared/ask-user";
import { useBaseDialog } from "../hooks/useBaseDialog";
import { sendToGlimpse } from "../util/glimpse";
import CancelConfirmModal from "./CancelConfirmModal";
import { CheckIcon, CommentIcon, RadioIcon, isSelectAllOption } from "./icons";
import MarkdownPreview from "./MarkdownPreview";
import OptionCard from "./OptionCard";

interface SelectDialogProps {
    payload: AskUserPayload;
    mode: "single" | "multi";
}

export default function SelectDialog({ payload, mode }: SelectDialogProps) {
    const isSingle = mode === "single";
    const [selected, setSelected] = useState<string | null>(null);
    const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
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
        selected: null as string | null,
        selectedSet: new Set<string>(),
        comment: "",
        showComment: false,
        activeIndex: -1,
        options: payload.options,
        allowFreeform: payload.allowFreeform,
        selectAllOption: undefined as typeof selectAllOption,
        mode,
    });
    stateRef.current = {
        selected,
        selectedSet,
        comment,
        showComment,
        activeIndex,
        options: payload.options,
        allowFreeform: payload.allowFreeform,
        selectAllOption,
        mode,
    };

    const toggle = useCallback((title: string, index?: number) => {
        const s = stateRef.current;
        if (index !== undefined) {
            setActiveIndex(index);
        }
        if (s.selectAllOption && title === s.selectAllOption.title) {
            const regular = s.options
                .filter((opt) => !isSelectAllOption(opt.title))
                .map((opt) => opt.title);
            if (isSingle) {
                setSelected(s.selectAllOption.title);
            } else {
                setSelectedSet(new Set(regular));
            }
            return;
        }
        if (isSingle) {
            setSelected(title);
        } else {
            setSelectedSet((prev) => {
                const next = new Set(prev);
                if (next.has(title)) next.delete(title);
                else next.add(title);
                return next;
            });
        }
    }, [isSingle]);

    const handleFreeform = useCallback(() => {
        toggle(FREEFORM_OPTION_TITLE, payload.options.length);
        freeformRef.current?.focus();
        freeformRef.current?.scrollIntoView({ block: "nearest" });
    }, [toggle, payload.options.length]);

    const handleSubmit = useCallback(() => {
        const s = stateRef.current;

        const send = (result: Record<string, unknown>) => {
            if (s.comment.trim()) {
                result.comment = s.comment.trim();
            }
            sendToGlimpse(result);
        };

        if (s.mode === "single") {
            if (s.selected === FREEFORM_OPTION_TITLE) {
                send({ kind: "freeform", text: "" });
                return;
            }
            const fallbackSelection =
                s.activeIndex >= 0 && s.activeIndex < s.options.length
                    ? s.options[s.activeIndex].title
                    : null;
            const selection = s.selected ?? fallbackSelection;
            if (s.allowFreeform && selection === null) {
                send({ kind: "freeform", text: "" });
            } else {
                send({ kind: "selection", selections: selection ? [selection] : [] });
            }
        } else {
            const hasFreeform = s.selectedSet.has(FREEFORM_OPTION_TITLE);
            const hasSelection = s.selectedSet.size > 0;
            if (hasFreeform) {
                send({ kind: "selection", selections: Array.from(s.selectedSet) });
                return;
            }
            if (!hasSelection && s.allowFreeform) {
                send({ kind: "freeform", text: "" });
                return;
            }
            send({ kind: "selection", selections: Array.from(s.selectedSet) });
        }
    }, []);

    const isDirty = isSingle
        ? selected !== null || comment.trim() !== ""
        : selectedSet.size > 0 || comment.trim() !== "";

    const { showCancelConfirm, setShowCancelConfirm, handleCancel, handleDiscard, handleSubmit: baseHandleSubmit } = useBaseDialog({
        payload,
        isDirty,
        onSubmit: handleSubmit,
        isCommentOpen: showComment,
        onCloseComment: () => setShowComment(false),
        submitDisabled: !hasFreeform && (isSingle ? selected === null : selectedSet.size === 0),
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

            if (e.key === "Escape") return;
            if (e.key === "Tab") return;
            if (isInInput) return;
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) return;

            if (e.key >= "1" && e.key <= "9") {
                const idx = parseInt(e.key, 10) - 1;
                if (idx >= 0 && idx < s.options.length) {
                    const opt = s.options[idx];
                    if (s.mode === "single") {
                        setSelected(opt.title);
                    } else {
                        toggle(opt.title);
                    }
                    setActiveIndex(idx);
                    optionRefs.current[idx]?.focus();
                    optionRefs.current[idx]?.scrollIntoView({ block: "nearest" });
                }
                return;
            }

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
                        optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
                    } else if (s.allowFreeform && next === s.options.length) {
                        freeformRef.current?.focus();
                        freeformRef.current?.scrollIntoView({ block: "nearest" });
                    }
                    return next;
                });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = Math.max(prev - 1, 0);
                    if (next < s.options.length) {
                        optionRefs.current[next]?.focus();
                        optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
                    } else if (s.allowFreeform && next === s.options.length) {
                        freeformRef.current?.focus();
                        freeformRef.current?.scrollIntoView({ block: "nearest" });
                    }
                    return next;
                });
            } else if (e.key === "Enter") {
                if (s.mode === "single") {
                    const focusedEl = document.activeElement;
                    const freeformFocused =
                        s.allowFreeform &&
                        focusedEl != null &&
                        (focusedEl === freeformRef.current ||
                            freeformRef.current?.contains(focusedEl));
                    if (freeformFocused) {
                        e.preventDefault();
                        setSelected(FREEFORM_OPTION_TITLE);
                        return;
                    }
                    // If an OptionCard is focused, submit its option
                    const optionTitle =
                        focusedEl instanceof HTMLElement
                            ? focusedEl.getAttribute("data-option")
                            : null;
                    if (optionTitle) {
                        e.preventDefault();
                        // Direct ref mutation required: baseHandleSubmit reads
                        // stateRef.current synchronously before React batches the
                        // setSelected update, so the ref must be up-to-date.
                        stateRef.current.selected = optionTitle;
                        setSelected(optionTitle);
                        baseHandleSubmit();
                        return;
                    }
                    // Fallback: submit the active option
                    if (s.activeIndex >= 0 && s.activeIndex < s.options.length) {
                        e.preventDefault();
                        const opt = s.options[s.activeIndex];
                        stateRef.current.selected = opt.title;
                        setSelected(opt.title);
                        baseHandleSubmit();
                        return;
                    }
                    if (s.allowFreeform && s.activeIndex === s.options.length) {
                        e.preventDefault();
                        setSelected(FREEFORM_OPTION_TITLE);
                        return;
                    }
                }
                // Multi-select: Enter/Space activation is handled by OptionCard itself
                // to avoid double-toggle (OptionCard onKeyDown + window listener both fire).
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggle, maxIndex, isSingle, baseHandleSubmit]);

    return (
        <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto p-4">
                {!isSingle && (
                    <div className="mb-2 flex items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            {selectedSet.size} selected
                        </div>
                        {/* Live region for screen readers to announce selection changes */}
                        <div aria-live="polite" aria-atomic="true" className="sr-only">
                            {selectedSet.size} option{selectedSet.size === 1 ? "" : "s"} selected
                        </div>
                        {selectedSet.size > 0 && (
                            <button
                                onClick={() => setSelectedSet(new Set())}
                                className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                )}
                {!isSingle && payload.options.length > 1 && (
                    <div className="mb-2 flex items-center gap-2">
                        <button
                            onClick={() => {
                                const allRegular = payload.options
                                    .filter((opt) => !isSelectAllOption(opt.title))
                                    .map((opt) => opt.title);
                                setSelectedSet(new Set(allRegular));
                            }}
                            className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
                        >
                            Select all
                        </button>
                        <span className="text-xs text-muted-foreground">·</span>
                        <button
                            onClick={() => setSelectedSet(new Set())}
                            className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
                        >
                            Select none
                        </button>
                    </div>
                )}

                <div className="space-y-2" role="listbox" aria-label="Options" aria-multiselectable={!isSingle}>
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
                                isSelected={isSingle ? selected === opt.title : selectedSet.has(opt.title)}
                                isActive={activeIndex === idx}
                                mode={mode}
                                onClick={() => toggle(opt.title, idx)}
                                recommended={opt.recommended}
                                tabIndex={activeIndex === idx ? 0 : -1}
                                data-option={opt.title}
                            />
                        ))
                    ) : (
                        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                            No options available.
                            {payload.allowFreeform && (
                                <span> Use "My answer isn't listed above" below to submit your own.</span>
                            )}
                        </div>
                    )}
                    {hasFreeform && (
                        <button
                            ref={freeformRef}
                            tabIndex={activeIndex === payload.options.length ? 0 : -1}
                            onClick={handleFreeform}
                            role="option"
                            aria-selected={isSingle ? selected === FREEFORM_OPTION_TITLE : selectedSet.has(FREEFORM_OPTION_TITLE)}
                            className={`mt-4 flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                                (isSingle ? selected === FREEFORM_OPTION_TITLE : selectedSet.has(FREEFORM_OPTION_TITLE))
                                    ? "border-primary bg-primary/5"
                                    : "border-dashed border-border text-muted-foreground hover:bg-accent"
                            } ${activeIndex === payload.options.length ? "ring-2 ring-ring" : ""}`}
                        >
                            {isSingle ? (
                                <RadioIcon checked={selected === FREEFORM_OPTION_TITLE} />
                            ) : (
                                <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                                    selectedSet.has(FREEFORM_OPTION_TITLE)
                                        ? "bg-primary text-primary-foreground"
                                        : "border border-border"
                                }`}>
                                    {selectedSet.has(FREEFORM_OPTION_TITLE) && <CheckIcon checked={true} />}
                                </div>
                            )}
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                -
                            </span>
                            <span className="font-medium">{FREEFORM_OPTION_TITLE}</span>
                        </button>
                    )}
                </div>
            </div>

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
                onDiscard={handleDiscard}
            />
        </div>
    );
}

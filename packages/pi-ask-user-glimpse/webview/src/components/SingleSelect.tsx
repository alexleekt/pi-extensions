import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FREEFORM_OPTION_TITLE, type AskUserPayload } from "../../../shared/ask-user";
import { useDialogKeys } from "../hooks/useDialogKeys";
import { sendCancelled, sendToGlimpse } from "../util/glimpse";
import CancelConfirmModal from "./CancelConfirmModal";
import DialogFooter from "./DialogFooter";
import { useFooterPortal } from "./FooterContext";
import GlobalKeyboardHint from "./GlobalKeyboardHint";
import { CommentIcon, RadioIcon } from "./icons";
import MarkdownPreview from "./MarkdownPreview";
import OptionCard from "./OptionCard";
import RichText from "./RichText";

interface SingleSelectProps {
    payload: AskUserPayload;
}

export default function SingleSelect({ payload }: SingleSelectProps) {
    const [selected, setSelected] = useState<string | null>(null);
    const [comment, setComment] = useState("");
    const [showComment, setShowComment] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const freeformRef = useRef<HTMLButtonElement | null>(null);

    const hasFreeform = payload.allowFreeform;
    const maxIndex = hasFreeform ? payload.options.length : payload.options.length - 1;

    const stateRef = useRef({
        selected: null as string | null,
        comment: "",
        showComment: false,
        activeIndex: -1,
        isSubmitting: false,
        options: payload.options,
        allowFreeform: payload.allowFreeform,
    });
    stateRef.current = {
        selected,
        comment,
        showComment,
        activeIndex,
        isSubmitting,
        options: payload.options,
        allowFreeform: payload.allowFreeform,
    };

    const sendResult = useCallback((selection: string | null) => {
        const s = stateRef.current;
        const result: Record<string, unknown> = {
            kind: "selection",
            selections: selection ? [selection] : [],
        };
        if (s.showComment && s.comment.trim())
            result.comment = s.comment.trim();
        sendToGlimpse(result);
    }, []);

    const sendFreeformResult = useCallback(() => {
        const s = stateRef.current;
        const result: Record<string, unknown> = {
            kind: "freeform",
            text: "",
        };
        if (s.showComment && s.comment.trim())
            result.comment = s.comment.trim();
        sendToGlimpse(result);
    }, []);

    const handleFreeform = useCallback(() => {
        setSelected(FREEFORM_OPTION_TITLE);
        setActiveIndex(payload.options.length);
        freeformRef.current?.focus();
        freeformRef.current?.scrollIntoView({ block: "nearest" });
    }, [payload.options.length]);

    const handleSubmit = useCallback(() => {
        const s = stateRef.current;
        if (s.isSubmitting) return;
        setIsSubmitting(true);

        if (s.selected === FREEFORM_OPTION_TITLE) {
            sendFreeformResult();
            return;
        }

        const fallbackSelection =
            s.activeIndex >= 0 && s.activeIndex < s.options.length
                ? s.options[s.activeIndex].title
                : null;
        const selection = s.selected ?? fallbackSelection;
        if (s.allowFreeform && selection === null) {
            sendFreeformResult();
        } else {
            sendResult(selection);
        }
    }, [sendResult, sendFreeformResult]);

    const isDirty =
        selected !== null ||
        comment.trim() !== "";

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

    /* Render footer via portal so it spans full window width beneath both panels. */
    const footer = useMemo(
        () => (
            <DialogFooter
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                hint={<GlobalKeyboardHint payload={payload} />}
                submitDisabled={!hasFreeform && selected === null}
            />
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isSubmitting, handleSubmit, handleCancel, payload, hasFreeform, selected],
    );
    useFooterPortal(footer);

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

            // Number keys 1-9 to select options (without submitting)
            if (e.key >= "1" && e.key <= "9") {
                const idx = parseInt(e.key, 10) - 1;
                if (idx >= 0 && idx < s.options.length) {
                    const opt = s.options[idx];
                    setSelected(opt.title);
                    setActiveIndex(idx);
                    optionRefs.current[idx]?.focus();
                    optionRefs.current[idx]?.scrollIntoView({
                        block: "nearest",
                    });
                }
                return;
            }

            // Minus key to select freeform option (without submitting)
            if (e.key === "-" || e.key === "_") {
                if (s.allowFreeform) {
                    e.preventDefault();
                    setSelected(FREEFORM_OPTION_TITLE);
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
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (s.isSubmitting) return;
                const focusedEl = document.activeElement;
                const freeformFocused =
                    s.allowFreeform &&
                    focusedEl != null &&
                    (focusedEl === freeformRef.current ||
                        freeformRef.current?.contains(focusedEl));
                if (freeformFocused) {
                    // Enter on freeform: only select, do not submit
                    setSelected(FREEFORM_OPTION_TITLE);
                } else if (
                    s.activeIndex >= 0 &&
                    s.activeIndex < s.options.length
                ) {
                    const opt = s.options[s.activeIndex];
                    setSelected(opt.title);
                    setIsSubmitting(true);
                    sendResult(opt.title);
                } else if (s.allowFreeform && s.activeIndex === s.options.length) {
                    // Freeform is active via navigation but not focused: just select
                    setSelected(FREEFORM_OPTION_TITLE);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [sendResult, maxIndex]);

    return (
        <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2" role="listbox" aria-label="Options">
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
                                isSelected={selected === opt.title}
                                isActive={activeIndex === idx}
                                mode="single"
                                onClick={() => setSelected(opt.title)}
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
                        aria-selected={selected === FREEFORM_OPTION_TITLE}
                        className={`mt-4 flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                            selected === FREEFORM_OPTION_TITLE
                                ? "border-primary bg-primary/5"
                                : "border-dashed border-border text-muted-foreground hover:bg-accent"
                        } ${activeIndex === payload.options.length ? "ring-2 ring-ring" : ""}`}
                    >
                        <RadioIcon checked={selected === FREEFORM_OPTION_TITLE} />
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

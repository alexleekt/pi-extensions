import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { sendToGlimpse } from "../util/glimpse";
import { highlightMatch } from "../util/html";
import { useDialogKeys } from "../hooks/useDialogKeys";
import DialogFooter from "./DialogFooter";
import AdditionalComments from "./AdditionalComments";
import { CheckIcon, CommentIcon, RadioIcon, isSelectAllOption } from "./icons";

interface MultiSelectProps {
    payload: AskUserPayload;
    showHeader?: boolean;
}

export default function MultiSelect({ payload, showHeader = true }: MultiSelectProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [comment, setComment] = useState("");
    const [showComment, setShowComment] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(-1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [additionalComments, setAdditionalComments] = useState("");
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const searchRef = useRef<HTMLInputElement | null>(null);

    const showSearch = payload.options.length > 6 || payload.allowFreeform;

    const filtered = useMemo(() => {
        if (!query) return payload.options;
        const q = query.toLowerCase();
        return payload.options.filter(
            (o) => o.title.toLowerCase().includes(q) || (o.description?.toLowerCase() ?? "").includes(q),
        );
    }, [payload.options, query]);

    const selectAllOpt = useMemo(() => payload.options.find((opt) => isSelectAllOption(opt.title)), [payload.options]);

    /* ── Refs for stable keydown handler ── */
    const stateRef = useRef({
        selected: new Set<string>(),
        comment: "",
        showComment: false,
        additionalComments: "",
        query: "",
        activeIndex: -1,
        isSubmitting: false,
        filtered: payload.options,
        allowFreeform: payload.allowFreeform,
        selectAllOpt: undefined as typeof selectAllOpt,
    });
    stateRef.current = {
        selected, comment, showComment, additionalComments, query, activeIndex, isSubmitting, filtered, allowFreeform: payload.allowFreeform, selectAllOpt,
    };

    const toggle = useCallback((title: string) => {
        const s = stateRef.current;
        if (s.selectAllOpt && title === s.selectAllOpt.title) {
            const regular = s.filtered.filter((opt) => !isSelectAllOption(opt.title)).map((opt) => opt.title);
            setSelected(new Set(regular));
            return;
        }
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title); else next.add(title);
            if (s.selectAllOpt && next.has(s.selectAllOpt.title)) next.delete(s.selectAllOpt.title);
            return next;
        });
    }, []);

    const handleSubmit = useCallback(() => {
        const s = stateRef.current;
        if (s.isSubmitting) return;
        const hasSelection = s.selected.size > 0;
        const hasFreeform = s.query && s.allowFreeform;
        if (!hasSelection && !hasFreeform) return;
        setIsSubmitting(true);
        if (!hasSelection && hasFreeform) {
            handleFreeform();
            return;
        }
        const result: Record<string, unknown> = { kind: "selection", selections: Array.from(s.selected) };
        if (s.showComment && s.comment.trim()) result.comment = s.comment.trim();
        if (s.additionalComments.trim()) result.additionalComments = s.additionalComments.trim();
        sendToGlimpse(result);
    }, [handleFreeform]);

    const handleFreeform = useCallback(() => {
        sendToGlimpse({ kind: "freeform", text: stateRef.current.query });
    }, []);

    useDialogKeys({
        onSubmit: handleSubmit,
        isSubmitting,
        isCommentOpen: showComment,
        onCloseComment: () => setShowComment(false),
    });

    useEffect(() => {
        setActiveIndex(-1);
        if (!showSearch) {
            const id = requestAnimationFrame(() => {
                optionRefs.current[0]?.focus();
                setActiveIndex(0);
            });
            return () => cancelAnimationFrame(id);
        }
    }, [showSearch]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const s = stateRef.current;
            const target = e.target as HTMLElement;
            const isInInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

            if (e.key === "Escape") return; // handled by useDialogKeys
            if (e.key === "Tab") return;
            if (target === searchRef.current && e.key === "ArrowDown") {
                e.preventDefault(); setActiveIndex(0); optionRefs.current[0]?.focus(); return;
            }
            if (isInInput) return;
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) return; // handled by useDialogKeys

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = Math.min(prev + 1, s.filtered.length - 1);
                    optionRefs.current[next]?.focus();
                    optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
                    return next;
                });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = Math.max(prev - 1, -1);
                    if (next === -1) searchRef.current?.focus();
                    else { optionRefs.current[next]?.focus(); optionRefs.current[next]?.scrollIntoView({ block: "nearest" }); }
                    return next;
                });
            } else if (e.key === " " || e.key === "Spacebar") {
                e.preventDefault();
                if (s.activeIndex >= 0 && s.activeIndex < s.filtered.length) toggle(s.filtered[s.activeIndex].title);
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (s.activeIndex >= 0 && s.activeIndex < s.filtered.length) {
                    toggle(s.filtered[s.activeIndex].title);
                } else if (s.query && s.allowFreeform) {
                    setIsSubmitting(true); handleFreeform();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggle, handleSubmit, handleFreeform]);

    const hasResults = filtered.length > 0;

    return (
        <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-border p-4">
                {showHeader && (
                    <div className="max-h-24 overflow-y-auto">
                        <h1 className="text-lg font-semibold">{payload.question}</h1>
                        {payload.context && <p className="mt-1 text-sm text-muted-foreground">{payload.context}</p>}
                    </div>
                )}
                {showSearch && (
                    <input ref={searchRef} type="text" placeholder="Search options..." value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring ${showHeader ? "mt-3" : ""}`} />
                )}
                {selected.size > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            {selected.size} selected
                        </div>
                        <button onClick={() => setSelected(new Set())}
                            className="text-xs text-muted-foreground underline transition-colors hover:text-foreground">Clear all</button>
                    </div>
                )}
                {filtered.length > 1 && !query && (
                    <div className="mt-2 flex items-center gap-2">
                        <button onClick={() => {
                            const allRegular = payload.options
                                .filter((opt) => !isSelectAllOption(opt.title))
                                .map((opt) => opt.title);
                            setSelected(new Set(allRegular));
                        }}
                            className="text-xs text-muted-foreground underline transition-colors hover:text-foreground">Select all</button>
                        <span className="text-xs text-muted-foreground">·</span>
                        <button onClick={() => setSelected(new Set())}
                            className="text-xs text-muted-foreground underline transition-colors hover:text-foreground">Select none</button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2" role="listbox" aria-label="Options" aria-multiselectable="true">
                    {hasResults ? (
                        filtered.map((opt, idx) => {
                            const isSelected = selected.has(opt.title);
                            const isSelectAll = isSelectAllOption(opt.title);
                            const titleHtml = highlightMatch(opt.title, query);
                            const descHtml = opt.description ? highlightMatch(opt.description, query) : null;
                            return (
                                <button ref={(el) => { optionRefs.current[idx] = el; }} key={opt.title}
                                    tabIndex={activeIndex === idx ? 0 : -1} onClick={() => toggle(opt.title)}
                                    role="option" aria-selected={isSelected}
                                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                                        isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent"
                                    } ${activeIndex === idx ? "ring-2 ring-ring" : ""}`}>
                                    {isSelectAll ? (
                                        <RadioIcon checked={isSelected} />
                                    ) : (
                                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                                            isSelected ? "bg-primary text-primary-foreground" : "border border-border"
                                        }`}>
                                            {isSelected && <CheckIcon checked={true} />}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <div className="font-medium" dangerouslySetInnerHTML={{ __html: titleHtml }} />
                                        {opt.description && (
                                            <div className="mt-0.5 text-sm text-muted-foreground border-l-2 border-muted-foreground/30 pl-2.5"
                                                dangerouslySetInnerHTML={{ __html: descHtml! }} />
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                            No matching options.
                            {payload.allowFreeform && <span> Use "My answer isn't listed above" below to submit your own.</span>}
                        </div>
                    )}
                </div>

                {payload.allowFreeform && (
                    <button onClick={handleFreeform}
                        className="mt-4 w-full rounded-lg border border-dashed border-border p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent">
                        {query.trim() ? `Custom: "${query.trim().slice(0, 30)}${query.trim().length > 30 ? "…" : ""}"` : "My answer isn't listed above"}
                    </button>
                )}
            </div>

            <DialogFooter
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
                submitDisabled={selected.size === 0 && !(query && payload.allowFreeform)}
                hint="Space to toggle · Enter to toggle"
            >
                {payload.allowComment && (
                    <div className="mb-3">
                        <button onClick={() => setShowComment((s) => !s)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            aria-expanded={showComment}>
                            <CommentIcon />
                            {showComment ? "Hide comment" : comment.trim() ? "Edit comment" : "Add comment"}
                        </button>
                        {showComment && (
                            <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                                placeholder="Optional comment…"
                                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                                rows={3} />
                        )}
                    </div>
                )}
                <AdditionalComments value={additionalComments} onChange={setAdditionalComments} />
            </DialogFooter>
        </div>
    );
}

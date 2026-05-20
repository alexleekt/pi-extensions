import { useEffect, useMemo, useRef, useState } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { sendCancelled, sendToGlimpse } from "../util/glimpse";
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

    useEffect(() => {
        setActiveIndex(-1);
        optionRefs.current = [];
        if (!showSearch && optionRefs.current[0]) {
            optionRefs.current[0]?.focus();
            setActiveIndex(0);
        }
    }, [showSearch]);

    const selectAllOpt = useMemo(() => payload.options.find((opt) => isSelectAllOption(opt.title)), [payload.options]);

    const toggle = (title: string) => {
        if (selectAllOpt && title === selectAllOpt.title) {
            const regular = payload.options.filter((opt) => !isSelectAllOption(opt.title)).map((opt) => opt.title);
            setSelected(new Set(regular));
            return;
        }
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title); else next.add(title);
            if (selectAllOpt && next.has(selectAllOpt.title)) next.delete(selectAllOpt.title);
            return next;
        });
    };

    const handleSubmit = () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        const result: Record<string, unknown> = { kind: "selection", selections: Array.from(selected) };
        if (showComment && comment.trim()) result.comment = comment.trim();
        if (additionalComments.trim()) result.additionalComments = additionalComments.trim();
        sendToGlimpse(result);
    };

    const handleFreeform = () => {
        sendToGlimpse({ kind: "freeform", text: query });
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

            if (e.key === "Escape") {
                if (showComment) { e.preventDefault(); setShowComment(false); return; }
                sendCancelled();
                return;
            }
            if (e.key === "Tab") return;
            if (target === searchRef.current && e.key === "ArrowDown") {
                e.preventDefault(); setActiveIndex(0); optionRefs.current[0]?.focus(); return;
            }
            if (isInInput) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((prev) => {
                    const next = Math.min(prev + 1, filtered.length - 1);
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
                if (activeIndex >= 0 && activeIndex < filtered.length) toggle(filtered[activeIndex].title);
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < filtered.length) {
                    toggle(filtered[activeIndex].title);
                } else if (query && payload.allowFreeform) {
                    handleFreeform();
                } else {
                    handleSubmit();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [filtered, activeIndex, selected.size, showComment, query, payload.allowFreeform]);

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
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2" role="listbox" aria-label="Options" aria-multiselectable="true">
                    {hasResults ? (
                        filtered.map((opt, idx) => {
                            const isSelected = selected.has(opt.title);
                            const isSelectAll = isSelectAllOption(opt.title);
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
                                        <div className="font-medium">{opt.title}</div>
                                        {opt.description && (
                                            <div className="mt-0.5 text-sm text-muted-foreground border-l-2 border-muted-foreground/30 pl-2.5">
                                                {opt.description}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                            No matching options.
                            {payload.allowFreeform && <span> Use “My answer isn't listed above” below to submit your own.</span>}
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

            <div className="shrink-0 border-t border-border p-4">
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
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Space to toggle · Enter to submit</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => sendCancelled()}
                            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50">Cancel</button>
                        <button onClick={handleSubmit} disabled={isSubmitting}
                            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40">
                            {isSubmitting ? "Submitting…" : "Submit"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

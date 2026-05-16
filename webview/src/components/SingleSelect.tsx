import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { sendToGlimpse, sendCancelled } from "../util/glimpse";

interface SingleSelectProps {
	payload: AskUserPayload;
	showHeader?: boolean;
}

function RadioIcon({ checked }: { checked: boolean }) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			className="shrink-0 text-primary"
		>
			<circle
				cx="10"
				cy="10"
				r="9"
				stroke="currentColor"
				strokeWidth="2"
			/>
			{checked && <circle cx="10" cy="10" r="5" fill="currentColor" />}
		</svg>
	);
}

function CommentIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M14 10.5V4a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 4v6.5A1.5 1.5 0 0 0 3.5 12H5v2l2.5-2H12.5a1.5 1.5 0 0 0 1.5-1.5z" />
		</svg>
	);
}

export default function SingleSelect({ payload, showHeader = true }: SingleSelectProps) {
	const [selected, setSelected] = useState<string | null>(null);
	const [comment, setComment] = useState("");
	const [showComment, setShowComment] = useState(false);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(-1);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const searchRef = useRef<HTMLInputElement | null>(null);

	const showSearch = payload.options.length > 6 || payload.allowFreeform;

	const filtered = useMemo(() => {
		if (!query) return payload.options;
		const q = query.toLowerCase();
		return payload.options.filter(
			(o) =>
				o.title.toLowerCase().includes(q) ||
				(o.description?.toLowerCase() ?? "").includes(q),
		);
	}, [payload.options, query]);

	useEffect(() => {
		setActiveIndex(-1);
	}, [filtered.length]);

	useEffect(() => {
		optionRefs.current = [];
	}, [filtered]);

	// Auto-focus first option when there's no search box
	useEffect(() => {
		if (!showSearch && optionRefs.current[0]) {
			optionRefs.current[0]?.focus();
			setActiveIndex(0);
		}
	}, [showSearch]);

	const sendResult = useCallback((selection: string) => {
		const result: Record<string, unknown> = {
			kind: "selection",
			selections: [selection],
		};
		if (showComment && comment.trim()) {
			result.comment = comment.trim();
		}
		sendToGlimpse(result);
	}, [showComment, comment]);

	const handleSubmit = () => {
		if (!selected || isSubmitting) return;
		setIsSubmitting(true);
		sendResult(selected);
	};

	const handleFreeform = () => {
		sendToGlimpse({
			kind: "freeform",
			text: query,
		});
	};

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const isInInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

			if (e.key === "Escape") {
				if (showComment) {
					e.preventDefault();
					setShowComment(false);
					return;
				}
				sendCancelled();
				return;
			}

			if (e.key === "Tab") return;

			if (target === searchRef.current && e.key === "ArrowDown") {
				e.preventDefault();
				setActiveIndex(0);
				optionRefs.current[0]?.focus();
				return;
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
					if (next === -1) {
						searchRef.current?.focus();
					} else {
						optionRefs.current[next]?.focus();
						optionRefs.current[next]?.scrollIntoView({ block: "nearest" });
					}
					return next;
				});
			} else if (e.key === "Enter") {
				e.preventDefault();
				if (isSubmitting) return;
				if (activeIndex >= 0 && activeIndex < filtered.length) {
					const opt = filtered[activeIndex];
					setSelected(opt.title);
					setIsSubmitting(true);
					sendResult(opt.title);
				} else if (query && payload.allowFreeform) {
					setIsSubmitting(true);
					handleFreeform();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [filtered, activeIndex, showComment, sendResult, query, payload.allowFreeform]);

	const hasResults = filtered.length > 0;

	return (
		<div className="flex h-full flex-col">
			<div className="shrink-0 border-b border-border p-4">
				{showHeader && (
					<>
						<h1 className="text-lg font-semibold">{payload.question}</h1>
						{payload.context && (
							<p className="mt-1 text-sm text-muted-foreground">{payload.context}</p>
						)}
					</>
				)}
				{showSearch && (
					<input
						ref={searchRef}
						type="text"
						placeholder="Search options..."
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						autoFocus
						className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring ${showHeader ? "mt-3" : ""}`}
					/>
				)}
				{payload.allowFreeform && (
					<button
						onClick={handleFreeform}
						disabled={!query.trim()}
						className="mt-2 w-full rounded-lg border border-dashed border-border p-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
					>
						{query.trim() ? `Custom: "${query.trim().slice(0, 30)}${query.trim().length > 30 ? "…" : ""}"` : "Submit custom answer…"}
					</button>
				)}
			</div>

			<div className="flex-1 overflow-y-auto p-4">
				<div className="space-y-2" role="listbox" aria-label="Options">
					{hasResults ? (
						filtered.map((opt, idx) => (
							<button
								ref={(el) => { optionRefs.current[idx] = el; }}
								key={opt.title}
								tabIndex={activeIndex === idx ? 0 : -1}
								onClick={() => setSelected(opt.title)}
								role="option"
								aria-selected={selected === opt.title}
								className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
									selected === opt.title
										? "border-primary bg-primary/5"
										: "border-border bg-card hover:bg-accent"
								} ${activeIndex === idx ? "ring-2 ring-ring" : ""}`}
							>
								<RadioIcon checked={selected === opt.title} />
								<div className="min-w-0">
									<div className="font-medium">{opt.title}</div>
									{opt.description && (
										<div className="mt-0.5 text-sm text-muted-foreground border-l-2 border-muted-foreground/30 pl-2.5">
											{opt.description}
										</div>
									)}
								</div>
							</button>
						))
					) : (
						<div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
							No matching options.
							{payload.allowFreeform && (
								<span> Use “Other” above to submit “{query}”.</span>
							)}
						</div>
					)}
				</div>
			</div>

			<div className="shrink-0 border-t border-border p-4">
				{payload.allowComment && (
					<div className="mb-3">
						<button
							onClick={() => setShowComment((s) => !s)}
							className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							aria-expanded={showComment}
						>
							<CommentIcon />
							{showComment ? "Hide comment" : comment.trim() ? "Edit comment" : "Add comment"}
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
				<div className="flex items-center justify-between gap-2">
					<span className="text-xs text-muted-foreground">
						↑↓ to navigate · Enter to select
					</span>
					<div className="flex items-center gap-2">
						<button
							onClick={() =>
								sendCancelled()
							}
							className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50"
						>
							Cancel
						</button>
						<button
							onClick={handleSubmit}
							disabled={!selected || isSubmitting}
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

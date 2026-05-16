import { useState, useMemo, useEffect, useRef } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";

interface MultiSelectProps {
	payload: AskUserPayload;
	showHeader?: boolean;
}

function CheckIcon({ checked }: { checked: boolean }) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 20 20"
			fill="none"
			className="shrink-0"
		>
			<rect
				x="1"
				y="1"
				width="18"
				height="18"
				rx="4"
				stroke="currentColor"
				strokeWidth="2"
				className={checked ? "text-primary" : "text-border"}
			/>
			{checked && (
				<path
					d="M5 10l4 4 6-7"
					stroke="currentColor"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-primary-foreground"
				/>
			)}
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

export default function MultiSelect({ payload, showHeader = true }: MultiSelectProps) {
	const [selected, setSelected] = useState<Set<string>>(new Set());
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

	const toggle = (title: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(title)) next.delete(title);
			else next.add(title);
			return next;
		});
	};

	const handleSubmit = () => {
		const selections = Array.from(selected);
		if (selections.length === 0 || isSubmitting) return;
		setIsSubmitting(true);
		const result: Record<string, unknown> = {
			kind: "selection",
			selections,
		};
		if (showComment && comment.trim()) {
			result.comment = comment.trim();
		}
		(window as unknown as { glimpse: { send: (data: unknown) => void } }).glimpse.send(result);
	};

	const handleFreeform = () => {
		(window as unknown as { glimpse: { send: (data: unknown) => void } }).glimpse.send({
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
				(window as unknown as { glimpse: { send: (data: unknown) => void } }).glimpse.send({ __cancelled: true });
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
			} else if (e.key === " " || e.key === "Spacebar") {
				e.preventDefault();
				if (activeIndex >= 0 && activeIndex < filtered.length) {
					toggle(filtered[activeIndex].title);
				}
			} else if (e.key === "Enter") {
				e.preventDefault();
				if (activeIndex >= 0 && activeIndex < filtered.length) {
					toggle(filtered[activeIndex].title);
				} else if (selected.size > 0) {
					handleSubmit();
				} else if (query && payload.allowFreeform) {
					handleFreeform();
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
			</div>

			<div className="flex-1 overflow-y-auto p-4">
				<div className="space-y-2" role="listbox" aria-label="Options" aria-multiselectable="true">
					{hasResults ? (
						filtered.map((opt, idx) => {
							const isSelected = selected.has(opt.title);
							return (
								<button
									ref={(el) => { optionRefs.current[idx] = el; }}
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
									<div
										className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
											isSelected ? "bg-primary text-primary-foreground" : "border border-border"
										}`}
									>
										{isSelected && <CheckIcon checked={true} />}
									</div>
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
						Space to toggle · Enter to submit
					</span>
					<div className="flex items-center gap-2">
						<button
							onClick={() =>
								(window as unknown as { glimpse: { send: (data: unknown) => void } }).glimpse.send({ __cancelled: true })
							}
							className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50"
						>
							Cancel
						</button>
						<button
							onClick={handleSubmit}
							disabled={selected.size === 0 || isSubmitting}
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

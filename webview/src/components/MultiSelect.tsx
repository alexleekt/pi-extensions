import { useState, useMemo, useEffect, useRef } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";

interface MultiSelectProps {
	payload: AskUserPayload;
}

export default function MultiSelect({ payload }: MultiSelectProps) {
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [comment, setComment] = useState("");
	const [showComment, setShowComment] = useState(false);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(-1);
	const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const searchRef = useRef<HTMLInputElement | null>(null);

	const filtered = useMemo(() => {
		if (!query) return payload.options;
		const q = query.toLowerCase();
		return payload.options.filter(
			(o) =>
				o.title.toLowerCase().includes(q) ||
				(o.description?.toLowerCase() ?? "").includes(q),
		);
	}, [payload.options, query]);

	// Reset active index when filter changes
	useEffect(() => {
		setActiveIndex(-1);
	}, [filtered.length]);

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
		if (selections.length === 0) return;
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

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const isInInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

			// Escape: close comment textarea first, then cancel dialog
			if (e.key === "Escape") {
				if (showComment) {
					e.preventDefault();
					setShowComment(false);
					return;
				}
				(window as unknown as { glimpse: { send: (data: unknown) => void } }).glimpse.send({ __cancelled: true });
				return;
			}

			// Allow natural Tab behavior
			if (e.key === "Tab") return;

			// From search input: ArrowDown moves to first option
			if (target === searchRef.current && e.key === "ArrowDown") {
				e.preventDefault();
				setActiveIndex(0);
				optionRefs.current[0]?.focus();
				return;
			}

			// Don't intercept other keys when in text inputs
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
				if (selected.size > 0) {
					handleSubmit();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [filtered, activeIndex, selected.size, showComment]);

	return (
		<div className="flex h-screen flex-col">
			<div className="border-b border-border p-4">
				<h1 className="text-lg font-semibold">{payload.question}</h1>
				{payload.context && (
					<p className="mt-1 text-sm text-muted-foreground">{payload.context}</p>
				)}
				<input
					ref={searchRef}
					type="text"
					placeholder="Search options..."
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
				/>
			</div>

			<div className="flex-1 overflow-y-auto p-4">
				<div className="space-y-2">
					{filtered.map((opt, idx) => {
						const isSelected = selected.has(opt.title);
						return (
							<button
								ref={(el) => { optionRefs.current[idx] = el; }}
								key={opt.title}
								tabIndex={activeIndex === idx ? 0 : -1}
								onClick={() => toggle(opt.title)}
								className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
									isSelected
										? "border-primary bg-primary/5"
										: "border-border bg-card hover:bg-accent"
								} ${activeIndex === idx ? "ring-2 ring-ring" : ""}`}
							>
								<div
									className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
										isSelected
											? "border-primary bg-primary text-primary-foreground"
											: "border-input bg-background"
									}`}
								>
									{isSelected ? "✓" : ""}
								</div>
								<div>
									<div className="font-medium">{opt.title}</div>
									{opt.description && (
										<div className="mt-1 text-sm text-muted-foreground">{opt.description}</div>
									)}
								</div>
							</button>
						);
					})}
				</div>

				{payload.allowFreeform && (
					<button
						onClick={handleFreeform}
						className="mt-4 w-full rounded-lg border border-dashed border-border p-3 text-left text-muted-foreground hover:bg-accent"
					>
						Other: {query || "Type in search box and click here..."}
					</button>
				)}
			</div>

			<div className="border-t border-border p-4">
				<div className="mb-2 text-sm text-muted-foreground">
					{selected.size} selected
				</div>
				{payload.allowComment && (
					<div className="mb-3">
						<button
							onClick={() => setShowComment((s) => !s)}
							className="text-sm text-muted-foreground underline"
						>
							{showComment ? "Hide comment" : "Add comment"}
						</button>
						{showComment && (
							<textarea
								value={comment}
								onChange={(e) => setComment(e.target.value)}
								placeholder="Optional comment..."
								className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
								rows={2}
							/>
						)}
					</div>
				)}
				<div className="flex justify-end gap-2">
					<button
						onClick={() =>
							(window as unknown as { glimpse: { send: (data: unknown) => void } }).glimpse.send({ __cancelled: true })
						}
						className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
					>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						disabled={selected.size === 0}
						className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
					>
						Submit
					</button>
				</div>
			</div>
		</div>
	);
}

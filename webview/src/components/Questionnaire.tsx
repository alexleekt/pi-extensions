import { useState, useEffect, useRef } from "react";
import type { AskUserPayload, Question } from "../../../shared/ask-user";
import { modKey } from "../util/platform";
import { sendToGlimpse, sendCancelled } from "../util/glimpse";

interface QuestionnaireProps {
	payload: AskUserPayload;
	showHeader?: boolean;
}

type AnswerValue = string | string[];

function getQuestions(payload: AskUserPayload): Question[] {
	return payload.questions ?? [];
}

function RadioIcon({ checked }: { checked: boolean }) {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 text-primary">
			<circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" />
			{checked && <circle cx="10" cy="10" r="5" fill="currentColor" />}
		</svg>
	);
}

function CheckIcon({ checked }: { checked: boolean }) {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
			<rect x="1" y="1" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" className={checked ? "text-primary" : "text-border"} />
			{checked && (
				<path d="M5 10l4 4 6-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground" />
			)}
		</svg>
	);
}

export default function Questionnaire({ payload, showHeader = true }: QuestionnaireProps) {
	const questions = getQuestions(payload);
	const allowSkip = payload.allowSkip ?? false;
	const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
	const [comments, setComments] = useState<Record<string, string>>({});
	const [showCommentFor, setShowCommentFor] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const optionRefs = useRef<Map<string, HTMLButtonElement | HTMLTextAreaElement | null>>(new Map());
	const questionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

	// Auto-scroll to first unanswered question on mount
	useEffect(() => {
		const firstUnanswered = questions.find((q) => {
			const ans = answers[q.title];
			if (ans === undefined) return true;
			if (Array.isArray(ans)) return ans.length === 0;
			return String(ans).trim().length === 0;
		});
		if (firstUnanswered) {
			const el = questionRefs.current.get(firstUnanswered.title);
			if (el) {
				el.scrollIntoView({ behavior: "smooth", block: "start" });
				const hasOptions = firstUnanswered.options && firstUnanswered.options.length > 0;
				if (!hasOptions) {
					const textarea = optionRefs.current.get(`${firstUnanswered.title}-freeform`);
					textarea?.focus();
				}
			}
		}
	}, []);

	const setSingleAnswer = (questionTitle: string, value: string) => {
		setAnswers((prev) => ({ ...prev, [questionTitle]: value }));
	};

	const toggleMultiAnswer = (questionTitle: string, optionTitle: string) => {
		setAnswers((prev) => {
			const current = prev[questionTitle];
			const arr = Array.isArray(current) ? [...current] : current ? [current] : [];
			if (arr.includes(optionTitle)) {
				return { ...prev, [questionTitle]: arr.filter((v) => v !== optionTitle) };
			}
			return { ...prev, [questionTitle]: [...arr, optionTitle] };
		});
	};

	const handleSubmit = () => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		const questionnaireDetails = questions.map((q) => {
			const answer = answers[q.title];
			const answerText = Array.isArray(answer) ? answer.join(", ") : (answer ?? "").trim();
			return {
				question: q.title,
				answer: answerText,
				kind: (q.options && q.options.length > 0 ? "selection" : "freeform") as "selection" | "freeform",
				comment: comments[q.title]?.trim() || undefined,
			};
		});

		sendToGlimpse({
			kind: "questionnaire",
			selections: questionnaireDetails.map((s) => `${s.question}: ${s.answer}`),
			questionnaireDetails,
		});
	};

	const allAnswered = questions.every((q) => {
		const ans = answers[q.title];
		if (ans === undefined) return false;
		if (Array.isArray(ans)) return ans.length > 0;
		return String(ans).trim().length > 0;
	});

	const canSubmit = allowSkip || allAnswered;

	const answeredCount = questions.filter((q) => {
		const ans = answers[q.title];
		if (ans === undefined) return false;
		if (Array.isArray(ans)) return ans.length > 0;
		return String(ans).trim().length > 0;
	}).length;

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const isInInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

			if (e.key === "Escape") {
				if (showCommentFor) {
					e.preventDefault();
					setShowCommentFor(null);
					return;
				}
				sendCancelled();
				return;
			}

			if (e.key === "Tab") return;

			if (isInInput) {
				if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
					e.preventDefault();
					if (canSubmit) {
						handleSubmit();
					}
				}
				return;
			}

			if ((e.key === " " || e.key === "Spacebar") && target.tagName === "BUTTON") {
				const questionTitle = target.dataset.question;
				const optionTitle = target.dataset.option;
				if (questionTitle && optionTitle) {
					const q = questions.find((qq) => qq.title === questionTitle);
					if (q?.allowMultiple) {
						e.preventDefault();
						toggleMultiAnswer(questionTitle, optionTitle);
					}
				}
				return;
			}

			if (e.key === "ArrowUp" || e.key === "ArrowDown") {
				if (target.tagName === "BUTTON" && target.dataset.question) {
					e.preventDefault();
					const questionTitle = target.dataset.question;
					const currentOption = target.dataset.option;
					const siblings = Array.from(
						document.querySelectorAll<HTMLButtonElement>(
							`button[data-question="${questionTitle}"]`,
						),
					);
					const idx = siblings.findIndex((btn) => btn.dataset.option === currentOption);
					if (idx === -1) return;
					const nextIdx = e.key === "ArrowDown"
						? Math.min(idx + 1, siblings.length - 1)
						: Math.max(idx - 1, 0);
					const nextBtn = siblings[nextIdx];
					if (nextBtn) {
						nextBtn.focus();
						nextBtn.scrollIntoView({ block: "nearest" });
					}
				}
				return;
			}

			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				if (canSubmit) {
					handleSubmit();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [showCommentFor, canSubmit, questions]);

	return (
		<div className="flex h-full flex-col">
			{/* Progress bar */}
			<div className="shrink-0 h-1 w-full bg-muted">
				<div
					className="h-full bg-primary transition-all duration-300"
					style={{ width: `${(answeredCount / questions.length) * 100}%` }}
				/>
			</div>

			{showHeader && (
				<div className="shrink-0 border-b border-border p-4">
					<h1 className="text-lg font-semibold">{payload.question}</h1>
					{payload.context && (
						<p className="mt-1 text-sm text-muted-foreground">{payload.context}</p>
					)}
				</div>
			)}

			<div className="flex-1 overflow-y-auto p-4">
				<div className="mb-2 flex items-center justify-between">
					<span className="text-xs font-medium text-muted-foreground">
						{answeredCount} / {questions.length} answered
					</span>
				</div>

				<div className="space-y-3">
					{questions.map((q) => {
						const answer = answers[q.title];
						return (
							<div
								ref={(el) => { questionRefs.current.set(q.title, el); }}
								key={q.title}
								className="rounded-xl border border-border bg-card p-4"
							>
								<div className="mb-1 font-medium">{q.title}</div>
								{q.description && (
									<div className="mb-3 text-sm text-muted-foreground">
										{q.description}
									</div>
								)}

								{q.options && q.options.length > 0 ? (
									<div className="space-y-2">
										{q.allowMultiple ? (
											q.options.map((opt) => {
												const arr = Array.isArray(answer) ? answer : answer ? [answer] : [];
												const isSelected = arr.includes(opt.title);
												return (
													<button
														ref={(el) => { optionRefs.current.set(`${q.title}-${opt.title}`, el); }}
														key={opt.title}
														data-question={q.title}
														data-option={opt.title}
														onClick={() => toggleMultiAnswer(q.title, opt.title)}
														role="checkbox"
														aria-checked={isSelected}
														className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
															isSelected
																? "border-primary bg-primary/5"
																: "border-border hover:bg-accent"
														}`}
													>
														<div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${isSelected ? "bg-primary text-primary-foreground" : "border border-border"}`}>
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
											q.options.map((opt) => {
												const isSelected = answer === opt.title;
												return (
													<button
														ref={(el) => { optionRefs.current.set(`${q.title}-${opt.title}`, el); }}
														key={opt.title}
														data-question={q.title}
														data-option={opt.title}
														onClick={() => setSingleAnswer(q.title, opt.title)}
														role="radio"
														aria-checked={isSelected}
														className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
															isSelected
																? "border-primary bg-primary/5"
																: "border-border hover:bg-accent"
														}`}
													>
														<RadioIcon checked={isSelected} />
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
										)}
									</div>
								) : (
									<textarea
										ref={(el) => { optionRefs.current.set(`${q.title}-freeform`, el); }}
										placeholder="Your answer…"
										value={(answer as string) ?? ""}
										onChange={(e) => setSingleAnswer(q.title, e.target.value)}
										className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring resize-none"
										rows={3}
									/>
								)}

								{payload.allowComment && (
									<div className="mt-2">
										<button
											onClick={() =>
												setShowCommentFor((prev) =>
													prev === q.title ? null : q.title,
												)
											}
											className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
											aria-expanded={showCommentFor === q.title}
										>
											<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 10.5V4a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 4v6.5A1.5 1.5 0 0 0 3.5 12H5v2l2.5-2H12.5a1.5 1.5 0 0 0 1.5-1.5z" /></svg>
											{showCommentFor === q.title ? "Hide comment" : comments[q.title]?.trim() ? "Edit comment" : "Add comment"}
										</button>
										{showCommentFor === q.title && (
											<textarea
												value={comments[q.title] ?? ""}
												onChange={(e) =>
													setComments((prev) => ({
														...prev,
														[q.title]: e.target.value,
													}))
												}
												placeholder="Optional comment…"
												className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring resize-none"
												rows={3}
											/>
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>

			<div className="shrink-0 border-t border-border p-4">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						{allAnswered ? (
							<span className="text-primary font-medium">All answered — ready to submit</span>
							) : allowSkip ? (
							<span>{answeredCount} / {questions.length} answered · partial OK</span>
							) : (
							<span>{answeredCount} / {questions.length} answered</span>
							)}
						<span className="opacity-60">· {modKey()}+Enter to submit</span>
					</div>
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
							disabled={!canSubmit || isSubmitting}
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

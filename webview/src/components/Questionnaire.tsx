import { useState, useEffect, useRef } from "react";
import type { AskUserPayload, Question } from "../../../shared/ask-user";

interface QuestionnaireProps {
	payload: AskUserPayload;
}

type AnswerValue = string | string[];

function getQuestions(payload: AskUserPayload): Question[] {
	// Server only sends questionnaire type when questions are present.
	return payload.questions ?? [];
}

export default function Questionnaire({ payload }: QuestionnaireProps) {
	const questions = getQuestions(payload);
	const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
	const [comments, setComments] = useState<Record<string, string>>({});
	const [showCommentFor, setShowCommentFor] = useState<string | null>(null);
	const optionRefs = useRef<Map<string, HTMLButtonElement | HTMLInputElement | null>>(new Map());

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
		const questionnaireDetails = questions.map((q) => {
			const answer = answers[q.title];
			const answerText = Array.isArray(answer) ? answer.join(", ") : (answer ?? "");
			return {
				question: q.title,
				answer: answerText,
				kind: (q.options && q.options.length > 0 ? "selection" : "freeform") as "selection" | "freeform",
				comment: comments[q.title]?.trim() || undefined,
			};
		});

		(window as unknown as { glimpse: { send: (data: unknown) => void } }).glimpse.send({
			kind: "questionnaire",
			selections: questionnaireDetails.map((s) => `${s.question}: ${s.answer}`),
			questionnaireDetails,
		});
	};

	const allAnswered = questions.every((q) => {
		const ans = answers[q.title];
		if (ans === undefined) return false;
		if (Array.isArray(ans)) return ans.length > 0;
		return true; // freeform: allow empty string
	});

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const isInInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

			// Escape: close open comment textarea first, then cancel dialog
			if (e.key === "Escape") {
				if (showCommentFor) {
					e.preventDefault();
					setShowCommentFor(null);
					return;
				}
				(window as unknown as { glimpse: { send: (data: unknown) => void } }).glimpse.send({ __cancelled: true });
				return;
			}

			// Allow natural Tab behavior
			if (e.key === "Tab") return;

			// Don't intercept other keys when in text inputs (except Ctrl+Enter)
			if (isInInput) {
				if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
					e.preventDefault();
					if (allAnswered) {
						handleSubmit();
					}
				}
				return;
			}

			// Space toggles multi-select options when focused on a button
			if ((e.key === " " || e.key === "Spacebar") && target.tagName === "BUTTON") {
				// The button's onClick will handle the toggle; just ensure it doesn't scroll
				// But we want to specifically handle multi-select toggling via keyboard
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

			// Ctrl+Enter submits questionnaire
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				if (allAnswered) {
					handleSubmit();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [showCommentFor, allAnswered, questions]);

	return (
		<div className="flex h-screen flex-col">
			<div className="border-b border-border p-4">
				<h1 className="text-lg font-semibold">{payload.question}</h1>
				{payload.context && (
					<p className="mt-1 text-sm text-muted-foreground">{payload.context}</p>
				)}
			</div>

			<div className="flex-1 overflow-y-auto p-4">
				<div className="space-y-6">
					{questions.map((q) => {
						const answer = answers[q.title];
						return (
							<div
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
											// Multi-select checkboxes
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
														className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
															isSelected
																? "border-primary bg-primary/5"
																: "border-border hover:bg-accent"
														}`}
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
																<div className="mt-1 text-sm text-muted-foreground">
																	{opt.description}
																</div>
															)}
														</div>
													</button>
												);
											})
										) : (
											// Single-select radio buttons
											q.options.map((opt) => {
												const isSelected = answer === opt.title;
												return (
													<button
														ref={(el) => { optionRefs.current.set(`${q.title}-${opt.title}`, el); }}
														key={opt.title}
														data-question={q.title}
														data-option={opt.title}
														onClick={() => setSingleAnswer(q.title, opt.title)}
														className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
															isSelected
																? "border-primary bg-primary/5"
																: "border-border hover:bg-accent"
														}`}
													>
														<div
															className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
																isSelected
																	? "border-primary bg-primary text-primary-foreground"
																	: "border-input bg-background"
															}`}
														>
															{isSelected && (
																<div className="h-2.5 w-2.5 rounded-full bg-primary-foreground" />
															)}
														</div>
														<div>
															<div className="font-medium">{opt.title}</div>
															{opt.description && (
																<div className="mt-1 text-sm text-muted-foreground">
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
									// Freeform text input when no options provided
									<input
										ref={(el) => { optionRefs.current.set(`${q.title}-freeform`, el); }}
										type="text"
										placeholder="Your answer..."
										value={(answer as string) ?? ""}
										onChange={(e) => setSingleAnswer(q.title, e.target.value)}
										className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
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
											className="text-xs text-muted-foreground underline"
										>
											{showCommentFor === q.title
												? "Hide comment"
												: "Add comment"}
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
												placeholder="Optional comment..."
												className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
												rows={2}
											/>
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>

			<div className="border-t border-border p-4">
				<div className="mb-2 text-xs text-muted-foreground">
					Press Ctrl+Enter to submit
				</div>
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
						disabled={!allAnswered}
						className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
					>
						Submit
					</button>
				</div>
			</div>
		</div>
	);
}

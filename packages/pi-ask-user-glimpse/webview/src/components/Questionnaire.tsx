import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { useDialogKeys } from "../hooks/useDialogKeys";
import { sendCancelled, sendToGlimpse } from "../util/glimpse";
import { renderOptionText } from "../util/html";
import AdditionalComments from "./AdditionalComments";
import CancelConfirmModal from "./CancelConfirmModal";
import DialogFooter from "./DialogFooter";
import { useFooterPortal } from "./FooterContext";
import GlobalKeyboardHint from "./GlobalKeyboardHint";
import { CheckIcon, CommentIcon, isSelectAllOption, RadioIcon } from "./icons";

interface QuestionnaireProps {
    payload: AskUserPayload;
}

type AnswerValue = string | string[];

export default function Questionnaire({ payload }: QuestionnaireProps) {
    const questions = payload.questions ?? [];
    const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
    const [comments, setComments] = useState<Record<string, string>>({});
    const [showCommentFor, setShowCommentFor] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [additionalComments, setAdditionalComments] = useState("");
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const optionRefs = useRef<
        Map<string, HTMLButtonElement | HTMLTextAreaElement | null>
    >(new Map());
    const questionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
    const commentsRef = useRef<HTMLTextAreaElement | null>(null);

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
                const hasOptions =
                    firstUnanswered.options &&
                    firstUnanswered.options.length > 0;
                if (!hasOptions) {
                    optionRefs.current
                        .get(`${firstUnanswered.title}-freeform`)
                        ?.focus();
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setSingleAnswer = useCallback(
        (questionTitle: string, value: string) => {
            setAnswers((prev) => ({ ...prev, [questionTitle]: value }));
        },
        [],
    );

    const toggleMultiAnswer = useCallback(
        (questionTitle: string, optionTitle: string) => {
            const q = questions.find((qq) => qq.title === questionTitle);
            const selectAllOpt = q?.options?.find((opt) =>
                isSelectAllOption(opt.title),
            );

            if (selectAllOpt && optionTitle === selectAllOpt.title) {
                const regularOptions = (q?.options ?? [])
                    .filter((opt) => !isSelectAllOption(opt.title))
                    .map((opt) => opt.title);
                setAnswers((prev) => ({
                    ...prev,
                    [questionTitle]: regularOptions,
                }));
                return;
            }

            setAnswers((prev) => {
                const current = prev[questionTitle];
                const arr = Array.isArray(current)
                    ? [...current]
                    : current
                      ? [current]
                      : [];
                let next = arr.includes(optionTitle)
                    ? arr.filter((v) => v !== optionTitle)
                    : [...arr, optionTitle];
                if (selectAllOpt && next.includes(selectAllOpt.title)) {
                    next = next.filter((v) => v !== selectAllOpt.title);
                }
                return { ...prev, [questionTitle]: next };
            });
        },
        [questions],
    );

    const handleSubmit = useCallback(() => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        const questionnaireDetails = questions
            .map((q) => {
                const answer = answers[q.title];
                const answerText = Array.isArray(answer)
                    ? answer.join(", ")
                    : (answer ?? "").trim();
                if (!answerText) return null;
                return {
                    question: q.title,
                    answer: answerText,
                    kind: (q.options && q.options.length > 0
                        ? "selection"
                        : "freeform") as "selection" | "freeform",
                    comment: comments[q.title]?.trim() || undefined,
                };
            })
            .filter(Boolean) as {
            question: string;
            answer: string;
            kind: "selection" | "freeform";
            comment?: string;
        }[];

        const result: Record<string, unknown> = {
            kind: "questionnaire",
            selections: questionnaireDetails.map(
                (s) => `${s.question}: ${s.answer}`,
            ),
            questionnaireDetails,
        };
        if (additionalComments.trim())
            result.additionalComments = additionalComments.trim();
        sendToGlimpse(result);
    }, [isSubmitting, questions, answers, comments, additionalComments]);

    const answeredCount = questions.filter((q) => {
        const ans = answers[q.title];
        if (ans === undefined) return false;
        if (Array.isArray(ans)) return ans.length > 0;
        return String(ans).trim().length > 0;
    }).length;

    // Component-specific keydown: Space to toggle, Arrow navigation between options, number keys to select
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInInput =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement;

            if (e.key === "Escape") return; // handled by useDialogKeys
            if (e.key === "Tab") return; // browser handles zone navigation
            if (isInInput) return;
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) return; // handled by useDialogKeys

            const questionTitle = target
                .closest("[data-question]")
                ?.getAttribute("data-question");

            // Number keys 1-9 to select/toggle options in the focused question
            if (e.key >= "1" && e.key <= "9") {
                const idx = parseInt(e.key, 10) - 1;
                if (!questionTitle) return;
                const q = questions.find((qq) => qq.title === questionTitle);
                if (!q?.options || idx < 0 || idx >= q.options.length) return;
                const opt = q.options[idx];
                if (q.allowMultiple) {
                    toggleMultiAnswer(questionTitle, opt.title);
                } else {
                    setSingleAnswer(questionTitle, opt.title);
                }
                return;
            }

            // 0 to focus global additional comments
            if (e.key === "0") {
                e.preventDefault();
                commentsRef.current?.focus();
                commentsRef.current?.scrollIntoView({ block: "nearest" });
                return;
            }

            if (
                (e.key === " " || e.key === "Spacebar") &&
                target.tagName === "BUTTON"
            ) {
                const optionTitle = target.dataset.option;
                if (questionTitle && optionTitle) {
                    const q = questions.find(
                        (qq) => qq.title === questionTitle,
                    );
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
                    const currentOption = target.dataset.option;
                    const siblings = Array.from(
                        document.querySelectorAll<HTMLButtonElement>(
                            `button[data-question="${target.dataset.question}"]`,
                        ),
                    );
                    const idx = siblings.findIndex(
                        (btn) => btn.dataset.option === currentOption,
                    );
                    if (idx === -1) return;
                    const nextIdx =
                        e.key === "ArrowDown"
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
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [questions, toggleMultiAnswer, setSingleAnswer]);

    const isDirty =
        Object.keys(answers).length > 0 ||
        Object.values(comments).some((c) => c.trim() !== "") ||
        additionalComments.trim() !== "";

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
        isCommentOpen: !!showCommentFor,
        onCloseComment: () => setShowCommentFor(null),
    });

    /* Render footer via portal so it spans full window width beneath both panels. */
    const footer = useMemo(
        () => (
            <DialogFooter
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                hint={<GlobalKeyboardHint payload={payload} />}
            >
                {/* no extra children */}
            </DialogFooter>
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isSubmitting, handleSubmit, handleCancel, payload],
    );
    useFooterPortal(footer);

    return (
        <div className="flex h-full flex-col">
            <div className="shrink-0 h-1 w-full bg-muted">
                <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                        width: `${(answeredCount / questions.length) * 100}%`,
                    }}
                />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                        {answeredCount} / {questions.length} answered
                    </span>
                </div>

                <div className="space-y-3">
                    {questions.map((q) => {
                        const answer = answers[q.title];
                        const isAnswered =
                            answer !== undefined &&
                            (Array.isArray(answer)
                                ? answer.length > 0
                                : String(answer).trim().length > 0);
                        const isRequired = payload.allowSkip === false;
                        return (
                            <div
                                ref={(el) => {
                                    questionRefs.current.set(q.title, el);
                                }}
                                key={q.title}
                                data-question={q.title}
                                className={`rounded-xl border p-4 bg-card ${isRequired && !isAnswered ? "border-destructive/50" : "border-border"}`}
                            >
                                <div className="mb-1 flex items-center gap-2">
                                    <span className="font-medium">
                                        {q.title}
                                    </span>
                                    {isRequired && !isAnswered && (
                                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                                            Required
                                        </span>
                                    )}
                                </div>
                                {q.description && (
                                    <div className="mb-3 text-sm text-muted-foreground">
                                        {q.description}
                                    </div>
                                )}

                                {q.options && q.options.length > 0 ? (
                                    <div className="space-y-2">
                                        {q.allowMultiple
                                            ? q.options.map((opt, optIdx) => {
                                                  const arr = Array.isArray(
                                                      answer,
                                                  )
                                                      ? answer
                                                      : answer
                                                        ? [answer]
                                                        : [];
                                                  const isSelected =
                                                      arr.includes(opt.title);
                                                  const isSelectAll =
                                                      isSelectAllOption(
                                                          opt.title,
                                                      );
                                                  const titleHtml =
                                                      renderOptionText(
                                                          opt.title,
                                                      );
                                                  const descHtml =
                                                      opt.description
                                                          ? renderOptionText(
                                                                opt.description,
                                                            )
                                                          : null;
                                                  return (
                                                      <button
                                                          ref={(el) => {
                                                              optionRefs.current.set(
                                                                  `${q.title}-${opt.title}`,
                                                                  el,
                                                              );
                                                          }}
                                                          key={opt.title}
                                                          tabIndex={
                                                              optIdx === 0
                                                                  ? 0
                                                                  : -1
                                                          }
                                                          data-question={
                                                              q.title
                                                          }
                                                          data-option={
                                                              opt.title
                                                          }
                                                          onClick={() =>
                                                              toggleMultiAnswer(
                                                                  q.title,
                                                                  opt.title,
                                                              )
                                                          }
                                                          role={
                                                              isSelectAll
                                                                  ? "radio"
                                                                  : "checkbox"
                                                          }
                                                          aria-checked={
                                                              isSelected
                                                          }
                                                          className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                                                              isSelected
                                                                  ? "border-primary bg-primary/5"
                                                                  : "border-border hover:bg-accent"
                                                          }`}
                                                      >
                                                          {isSelectAll ? (
                                                              <RadioIcon
                                                                  checked={
                                                                      isSelected
                                                                  }
                                                              />
                                                          ) : (
                                                              <div
                                                                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                                                                      isSelected
                                                                          ? "bg-primary text-primary-foreground"
                                                                          : "border border-border"
                                                                  }`}
                                                              >
                                                                  {isSelected && (
                                                                      <CheckIcon
                                                                          checked={
                                                                              true
                                                                          }
                                                                      />
                                                                  )}
                                                              </div>
                                                          )}
                                                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                                              {optIdx + 1}
                                                          </span>
                                                          <div className="min-w-0">
                                                              <div className="flex items-center gap-2">
                                                                  <div
                                                                      className="font-medium"
                                                                      dangerouslySetInnerHTML={{
                                                                          __html: titleHtml,
                                                                      }}
                                                                  />
                                                                  {opt.recommended && (
                                                                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                                                      Recommended
                                                                  </span>
                                                                  )}
                                                              </div>
                                                              {descHtml && (
                                                                  <div
                                                                      className="mt-0.5 text-sm text-muted-foreground border-l-2 border-muted-foreground/30 pl-2.5"
                                                                      dangerouslySetInnerHTML={{
                                                                          __html: descHtml,
                                                                      }}
                                                                  />
                                                              )}
                                                          </div>
                                                      </button>
                                                  );
                                              })
                                            : q.options.map((opt, optIdx) => {
                                                  const isSelected =
                                                      answer === opt.title;
                                                  const titleHtml =
                                                      renderOptionText(
                                                          opt.title,
                                                      );
                                                  const descHtml =
                                                      opt.description
                                                          ? renderOptionText(
                                                                opt.description,
                                                            )
                                                          : null;
                                                  return (
                                                      <button
                                                          ref={(el) => {
                                                              optionRefs.current.set(
                                                                  `${q.title}-${opt.title}`,
                                                                  el,
                                                              );
                                                          }}
                                                          key={opt.title}
                                                          tabIndex={
                                                              optIdx === 0
                                                                  ? 0
                                                                  : -1
                                                          }
                                                          data-question={
                                                              q.title
                                                          }
                                                          data-option={
                                                              opt.title
                                                          }
                                                          onClick={() =>
                                                              setSingleAnswer(
                                                                  q.title,
                                                                  opt.title,
                                                              )
                                                          }
                                                          role="radio"
                                                          aria-checked={
                                                              isSelected
                                                          }
                                                          className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                                                              isSelected
                                                                  ? "border-primary bg-primary/5"
                                                                  : "border-border hover:bg-accent"
                                                          }`}
                                                      >
                                                          <RadioIcon
                                                              checked={
                                                                  isSelected
                                                              }
                                                          />
                                                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                                              {optIdx + 1}
                                                          </span>
                                                          <div className="min-w-0">
                                                              <div className="flex items-center gap-2">
                                                                  <div
                                                                      className="font-medium"
                                                                      dangerouslySetInnerHTML={{
                                                                          __html: titleHtml,
                                                                      }}
                                                                  />
                                                                  {opt.recommended && (
                                                                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                                                      Recommended
                                                                  </span>
                                                                  )}
                                                              </div>
                                                              {descHtml && (
                                                                  <div
                                                                      className="mt-0.5 text-sm text-muted-foreground border-l-2 border-muted-foreground/30 pl-2.5"
                                                                      dangerouslySetInnerHTML={{
                                                                          __html: descHtml,
                                                                      }}
                                                                  />
                                                              )}
                                                          </div>
                                                      </button>
                                                  );
                                              })}
                                    </div>
                                ) : (
                                    <div>
                                        <textarea
                                            ref={(el) => {
                                                optionRefs.current.set(
                                                    `${q.title}-freeform`,
                                                    el,
                                                );
                                            }}
                                            placeholder="Your answer…"
                                            value={(answer as string) ?? ""}
                                            onChange={(e) =>
                                                setSingleAnswer(
                                                    q.title,
                                                    e.target.value,
                                                )
                                            }
                                            maxLength={1000}
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring resize-none"
                                            rows={3}
                                        />
                                        <div className="mt-1 text-right text-xs text-muted-foreground">
                                            {String(answer ?? "").length}/1000
                                        </div>
                                    </div>
                                )}

                                {payload.allowComment && (
                                    <div className="mt-2">
                                        <button
                                            onClick={() =>
                                                setShowCommentFor((prev) =>
                                                    prev === q.title
                                                        ? null
                                                        : q.title,
                                                )
                                            }
                                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                            aria-expanded={
                                                showCommentFor === q.title
                                            }
                                        >
                                            <CommentIcon />
                                            {showCommentFor === q.title
                                                ? "Hide comment"
                                                : comments[q.title]?.trim()
                                                  ? "Edit comment"
                                                  : "Add comment"}
                                        </button>
                                        {showCommentFor === q.title && (
                                            <textarea
                                                value={comments[q.title] ?? ""}
                                                onChange={(e) =>
                                                    setComments((prev) => ({
                                                        ...prev,
                                                        [q.title]:
                                                            e.target.value,
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
                    <AdditionalComments
                        ref={commentsRef}
                        value={additionalComments}
                        onChange={setAdditionalComments}
                    />
                </div>
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

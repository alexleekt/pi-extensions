import { useCallback, useRef, useState } from "react";
import type { AskUserPayload } from "../../../shared/ask-user";
import { useBaseDialog } from "../hooks/useBaseDialog";
import { sendToGlimpse } from "../util/glimpse";
import CancelConfirmModal from "./CancelConfirmModal";
import QuestionCard from "./QuestionCard";

interface QuestionnaireProps {
    payload: AskUserPayload;
}

type AnswerValue = string | string[];

function isAnswered(answer: AnswerValue | undefined): boolean {
    if (answer === undefined) return false;
    if (Array.isArray(answer))
        return answer.some((a) => String(a).trim().length > 0);
    return String(answer).trim().length > 0;
}

export default function Questionnaire({ payload }: QuestionnaireProps) {
    const questions = payload.questions ?? [];
    const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
    const [comments, setComments] = useState<Record<string, string>>({});
    const [showCommentFor, setShowCommentFor] = useState<string | null>(null);

    const stateRef = useRef({
        answers: {} as Record<string, AnswerValue>,
        comments: {} as Record<string, string>,
        showCommentFor: null as string | null,
        questions,
    });
    stateRef.current = {
        answers,
        comments,
        showCommentFor,
        questions,
    };

    const handleSubmit = useCallback(() => {
        const s = stateRef.current;
        const questionnaireDetails = s.questions
            .map((q) => {
                const answer = s.answers[q.title];
                if (!isAnswered(answer)) return null;
                const answerText = Array.isArray(answer)
                    ? answer.join(", ")
                    : (answer ?? "").trim();
                return {
                    question: q.title,
                    answer: answerText,
                    kind: (q.options && q.options.length > 0
                        ? "selection"
                        : "freeform") as "selection" | "freeform",
                    comment: s.comments[q.title]?.trim() || undefined,
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
        sendToGlimpse(result);
    }, []);

    const isDirty =
        Object.values(answers).some(isAnswered) ||
        Object.values(comments).some((c) => c.trim() !== "");

    const answeredCount = questions.filter((q) =>
        isAnswered(answers[q.title]),
    ).length;

    const allAnswered = questions.every((q) => isAnswered(answers[q.title]));
    const submitDisabled = payload.allowSkip === false && !allAnswered;

    const {
        isSubmitting,
        showCancelConfirm,
        setShowCancelConfirm,
        handleCancel,
        handleStay,
        handleDiscard,
    } = useBaseDialog({
        payload,
        isDirty,
        onSubmit: handleSubmit,
        isCommentOpen: !!showCommentFor,
        onCloseComment: () => setShowCommentFor(null),
        submitDisabled,
    });

    const setSingleAnswer = useCallback((qTitle: string, value: string) => {
        setAnswers((prev) => ({ ...prev, [qTitle]: value }));
    }, []);

    const toggleMultiAnswer = useCallback(
        (qTitle: string, optTitle: string) => {
            setAnswers((prev) => {
                const current = prev[qTitle];
                const arr = Array.isArray(current)
                    ? current
                    : current
                      ? [current]
                      : [];
                const next = arr.includes(optTitle)
                    ? arr.filter((t) => t !== optTitle)
                    : [...arr, optTitle];
                return { ...prev, [qTitle]: next };
            });
        },
        [],
    );

    return (
        <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-border px-4 py-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                        {answeredCount} of {questions.length} answered
                    </span>
                    {answeredCount === questions.length && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            All answered
                        </span>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                    {questions.map((q, qIdx) => (
                        <div key={qIdx}>
                            <QuestionCard
                                question={q}
                                answer={answers[q.title]}
                                onSelect={(title) =>
                                    setSingleAnswer(q.title, title)
                                }
                                onToggleMulti={(title) =>
                                    toggleMultiAnswer(q.title, title)
                                }
                                onSetText={(text) =>
                                    setSingleAnswer(q.title, text)
                                }
                                comment={comments[q.title] ?? ""}
                                showComment={showCommentFor === q.title}
                                onToggleComment={
                                    payload.allowComment
                                        ? () =>
                                              setShowCommentFor((prev) =>
                                                  prev === q.title
                                                      ? null
                                                      : q.title,
                                              )
                                        : undefined
                                }
                                onCommentChange={
                                    payload.allowComment
                                        ? (text) =>
                                              setComments((prev) => ({
                                                  ...prev,
                                                  [q.title]: text,
                                              }))
                                        : undefined
                                }
                                allowComment={payload.allowComment}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <CancelConfirmModal
                isOpen={showCancelConfirm}
                onStay={handleStay}
                onDiscard={handleDiscard}
            />
        </div>
    );
}

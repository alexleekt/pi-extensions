/** Cross-session last-answer journal. When a dialog outlives its session
 *  (user runs /new or /reload at the same moment the user submits), the
 *  answer otherwise goes nowhere: pi has discarded the runner, journal, and
 *  pending turn. This writes a tiny best-effort snapshot to tmp BEFORE the
 *  answer is delivered anywhere, so a lost answer is recoverable.
 *
 *  Recovery is explicit (read the file), never auto-injected into a new
 *  dialog: an answer from a dead conversation pre-filled into a new question
 *  would answer the wrong question. */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface LastAnswer {
    question: string;
    answer: string;
    at: number;
}

function lastAnswerPath(): string {
    return join(tmpdir(), "pi-ask-user-glimpse", "last-answer.json");
}

export function pathForLastAnswer(): string {
    return lastAnswerPath();
}

/** Best-effort: a failed save must never break the dialog flow. */
export function saveLastAnswer(question: string, answer: string): void {
    try {
        if (!answer.trim()) return;
        mkdirSync(join(tmpdir(), "pi-ask-user-glimpse"), { recursive: true });
        const payload: LastAnswer = {
            question: question.slice(0, 500),
            answer: answer.slice(0, 32_000),
            at: Date.now(),
        };
        writeFileSync(lastAnswerPath(), JSON.stringify(payload, null, 2), {
            mode: 0o600,
        });
    } catch {
        // Stale/disposed session or unwritable tmp — skip.
    }
}

/** Returns the snapshot only if fresh (< maxAgeMs old), else undefined. */
export function readLastAnswer(
    maxAgeMs: number = 10 * 60_000,
): LastAnswer | undefined {
    try {
        const raw = JSON.parse(
            readFileSync(lastAnswerPath(), "utf8"),
        ) as Partial<LastAnswer>;
        if (typeof raw.answer !== "string" || !raw.answer.trim())
            return undefined;
        if (typeof raw.at !== "number" || Date.now() - raw.at > maxAgeMs)
            return undefined;
        return {
            question: typeof raw.question === "string" ? raw.question : "",
            answer: raw.answer,
            at: raw.at,
        };
    } catch {
        return undefined;
    }
}
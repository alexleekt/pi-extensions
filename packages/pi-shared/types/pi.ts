// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
//
// Shared types + runtime type guards for Pi host structures not exported
// by @earendil-works/pi-coding-agent. Best-effort declarations based on
// runtime shapes observed in extensions.

/** A single message content block within a journal entry. */
export interface MessageContentBlock {
    type: "text";
    text: string;
}

/** The message payload of a journal entry. */
export interface JournalEntryMessage {
    role: "user" | "assistant" | "system";
    content: string | unknown[];
}

/** A custom journal entry injected by an extension. */
export interface CustomJournalEntry {
    type: "custom";
    customType: string;
    data: Record<string, unknown>;
}

/** A message journal entry. */
export interface MessageJournalEntry {
    type: "message";
    message: JournalEntryMessage;
}

/** Union of all known journal entry types. */
export type JournalEntry = MessageJournalEntry | CustomJournalEntry;

/** Runtime type guard for message entries. */
export function isMessageEntry(e: unknown): e is MessageJournalEntry {
    if (!e || typeof e !== "object") return false;
    const entry = e as Record<string, unknown>;
    return entry.type === "message" && typeof entry.message === "object";
}

/** Runtime type guard for custom entries. */
export function isCustomEntry(e: unknown): e is CustomJournalEntry {
    if (!e || typeof e !== "object") return false;
    const entry = e as Record<string, unknown>;
    return (
        entry.type === "custom" &&
        typeof entry.customType === "string" &&
        typeof entry.data === "object" &&
        entry.data !== null
    );
}

/** Details returned by an askUser dialog result. */
export interface AskUserResultDetails {
    /** True when the user dismissed the dialog without answering. */
    cancelled?: boolean;
    /** True when the user accepted a default or pre-filled value. */
    confirmed?: boolean;
}

/** Result shape from ctx.ui.askUser() or glimpseui.prompt(). */
export interface AskUserResult {
    answer: string | string[] | null;
    details?: AskUserResultDetails;
}

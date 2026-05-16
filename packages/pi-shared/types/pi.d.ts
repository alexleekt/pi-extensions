// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
//
// Type stubs for Pi host structures not exported by @earendil-works/pi-coding-agent.
// These are best-effort declarations based on runtime shapes observed in extensions.
// They may drift as the host API evolves — update accordingly.

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
    return (
        typeof e === "object" &&
        e !== null &&
        (e as Record<string, unknown>).type === "message" &&
        typeof (e as Record<string, unknown>).message === "object"
    );
}

/** Runtime type guard for custom entries. */
export function isCustomEntry(e: unknown): e is CustomJournalEntry {
    return (
        typeof e === "object" &&
        e !== null &&
        (e as Record<string, unknown>).type === "custom" &&
        typeof (e as Record<string, unknown>).customType === "string"
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

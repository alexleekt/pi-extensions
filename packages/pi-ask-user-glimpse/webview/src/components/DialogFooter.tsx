import type { ReactNode } from "react";
import { sendCancelled } from "../util/glimpse";

interface DialogFooterProps {
    /** Whether a submission is already in flight. */
    isSubmitting: boolean;
    /** Called when the submit button is clicked. */
    onSubmit: () => void;
    /** Called when the cancel button is clicked or Escape is pressed. Defaults to sendCancelled(). */
    onCancel?: () => void;
    /** Optional hint shown on the left (e.g. <GlobalKeyboardHint />). */
    hint?: ReactNode;
    /** Optional additional content above the action bar (e.g. comment toggle). */
    children?: ReactNode;
    /** Optional extra buttons between Cancel and Submit. */
    extraActions?: ReactNode;
    /** Disable submit even when not submitting (e.g. nothing selected yet). */
    submitDisabled?: boolean;
}

export default function DialogFooter({
    isSubmitting,
    onSubmit,
    onCancel,
    hint,
    children,
    extraActions,
    submitDisabled,
}: DialogFooterProps) {
    return (
        <div className="shrink-0 border-t border-border p-4">
            {children}
            {/* Single row: hints left (flexible), buttons right (compact) */}
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">{hint}</div>
                <div className="flex shrink-0 items-center gap-2">
                    <button
                        onClick={onCancel ?? sendCancelled}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50"
                    >
                        Cancel
                    </button>
                    {extraActions}
                    <button
                        onClick={onSubmit}
                        disabled={isSubmitting || submitDisabled}
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                        {isSubmitting ? "Submitting…" : "Submit"}
                    </button>
                </div>
            </div>
        </div>
    );
}

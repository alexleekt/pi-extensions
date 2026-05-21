import { sendCancelled } from "../util/glimpse";
import { modKey } from "../util/platform";

interface DialogFooterProps {
    /** Whether a submission is already in flight. */
    isSubmitting: boolean;
    /** Called when the submit button is clicked. */
    onSubmit: () => void;
    /** Optional hint text shown on the left. Defaults to "{modKey}+Enter to submit". */
    hint?: string;
    /** Optional additional content above the action bar (e.g. comment toggle). */
    children?: React.ReactNode;
    /** Optional extra buttons between Cancel and Submit. */
    extraActions?: React.ReactNode;
    /** Disable submit even when not submitting (e.g. nothing selected yet). */
    submitDisabled?: boolean;
}

export default function DialogFooter({
    isSubmitting,
    onSubmit,
    hint = `${modKey()}+Enter to submit`,
    children,
    extraActions,
    submitDisabled,
}: DialogFooterProps) {
    return (
        <div className="shrink-0 border-t border-border p-4">
            {children}
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{hint}</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={sendCancelled}
                        className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50"
                    >
                        Cancel
                    </button>
                    {extraActions}
                    <button
                        onClick={onSubmit}
                        disabled={isSubmitting || submitDisabled}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                        {isSubmitting ? "Submitting…" : "Submit"}
                    </button>
                </div>
            </div>
        </div>
    );
}

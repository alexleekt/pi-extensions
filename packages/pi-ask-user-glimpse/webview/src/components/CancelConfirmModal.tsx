import { useEffect, useRef } from "react";

interface CancelConfirmModalProps {
    isOpen: boolean;
    onStay: () => void;
    onDiscard: () => void;
}

/** Modal overlay asking the user to confirm discarding unsaved changes.
 *  Replaces browser confirm() which may not work in sandboxed Glimpse webviews. */
export default function CancelConfirmModal({
    isOpen,
    onStay,
    onDiscard,
}: CancelConfirmModalProps) {
    const stayRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOpen) {
            stayRef.current?.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onStay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-confirm-title"
            aria-describedby="cancel-confirm-desc"
        >
            <div
                className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <h2
                    id="cancel-confirm-title"
                    className="text-base font-semibold text-foreground"
                >
                    Unsaved changes
                </h2>
                <p id="cancel-confirm-desc" className="mt-2 text-sm text-muted-foreground">
                    You have unsaved changes. If you cancel now, your progress
                    will be lost.
                </p>
                <div className="mt-6 flex items-center justify-end gap-2">
                    <button
                        ref={stayRef}
                        onClick={onStay}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                        Stay
                    </button>
                    <button
                        onClick={onDiscard}
                        className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50"
                    >
                        Discard
                    </button>
                </div>
            </div>
        </div>
    );
}

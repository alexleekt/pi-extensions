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
    const discardRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOpen) {
            stayRef.current?.focus();
        }
    }, [isOpen]);

    /** Trap keyboard events while modal is open so they don't bubble to the dialog
     *  (e.g., Escape calling sendCancelled behind the modal, or Cmd+Enter submitting). */
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onStay();
                return;
            }
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.stopPropagation();
                // Block submit while modal is open
                return;
            }
            if (e.key === "Tab") {
                const focusable = [stayRef.current, discardRef.current].filter(Boolean);
                const current = document.activeElement;
                const idx = focusable.findIndex((el) => el === current);
                if (e.shiftKey) {
                    const prev = idx <= 0 ? focusable.length - 1 : idx - 1;
                    focusable[prev]?.focus();
                } else {
                    const next = idx === focusable.length - 1 ? 0 : idx + 1;
                    focusable[next]?.focus();
                }
                e.preventDefault();
            }
        };
        window.addEventListener("keydown", handler, { capture: true });
        return () => window.removeEventListener("keydown", handler, { capture: true });
    }, [isOpen, onStay]);

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
                        ref={discardRef}
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

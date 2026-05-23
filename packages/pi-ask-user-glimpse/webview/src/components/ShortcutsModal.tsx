import { modKey } from "../util/platform";

interface ShortcutsModalProps {
    onClose: () => void;
}

const SHORTCUTS = [
    { keys: ["1", "…", "9"], action: "Select or toggle option" },
    { keys: ["0"], action: "Focus additional comments" },
    { keys: ["↑", "↓"], action: "Navigate options" },
    { keys: ["Enter"], action: "Select / Submit" },
    { keys: [`${modKey()}+Enter`], action: "Submit answer" },
    { keys: ["Space"], action: "Toggle multi-select option" },
    { keys: ["Tab"], action: "Move focus between blocks" },
    { keys: ["Escape"], action: "Cancel dialog" },
];

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
                    <button
                        onClick={onClose}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                    </button>
                </div>
                <div className="space-y-2">
                    {SHORTCUTS.map((s) => (
                        <div key={s.action} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-foreground">{s.action}</span>
                            <div className="flex items-center gap-1">
                                {s.keys.map((k) => (
                                    <kbd
                                        key={k}
                                        className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground"
                                    >
                                        {k}
                                    </kbd>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-4 text-center">
                    <button
                        onClick={onClose}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}

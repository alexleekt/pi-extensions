export interface HintItem {
    /** One or more key badges to display. */
    keys: string[];
    /** Short label describing what the keys do. */
    label: string;
}

interface KeyboardHintProps {
    /** Array of key groups to render. */
    items: HintItem[];
}

/**
 * Renders keyboard navigation hints as styled `<kbd>` badges.
 *
 * Each item shows one or more key badges followed by a short label,
 * making shortcuts scannable at a glance. Matches the visual language
 * used in ShortcutsModal.
 */
export default function KeyboardHint({ items }: KeyboardHintProps) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {items.map((item, idx) => (
                <span key={idx} className="inline-flex items-center gap-1">
                    {item.keys.map((k) => (
                        <kbd
                            key={k}
                            className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-mono leading-none text-muted-foreground"
                        >
                            {k}
                        </kbd>
                    ))}
                    <span className="text-[11px] text-muted-foreground">
                        {item.label}
                    </span>
                </span>
            ))}
        </div>
    );
}

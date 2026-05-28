import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnimationLevel, ThemeMode } from "../../../shared/ask-user";
import { useSettings } from "../util/settings";

function CogIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="2.5" />
            <path d="M12.8 8a4.8 4.8 0 0 0 .2-1.2l1.8-.5-.9-2.4-1.8.5a4.8 4.8 0 0 0-1.2-.7l.2-1.9h-2.6l.2 1.9a4.8 4.8 0 0 0 1.2.7l-1.8-.5-.9 2.4 1.8.5a4.8 4.8 0 0 0 .2 1.2l-1.8.5.9 2.4 1.8-.5a4.8 4.8 0 0 0 1.2.7l-.2 1.9h2.6l-.2-1.9a4.8 4.8 0 0 0 1.2-.7l1.8.5.9-2.4-1.8-.5z" />
        </svg>
    );
}

function ThemeIcon({ theme }: { theme: ThemeMode }) {
    if (theme === "dark") return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.8 11.2A5.5 5.5 0 0 1 6.3 2.7 6.5 6.5 0 1 0 12.8 11.2z" />
        </svg>
    );
    if (theme === "light") return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.9 11.9l1.06 1.06M3.05 12.95l1.06-1.06M11.9 4.1l1.06-1.06" />
        </svg>
    );
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="12" height="10" rx="2" />
            <path d="M5 8h6" />
        </svg>
    );
}

interface SettingsButtonProps {
    buttonClassName?: string;
}

/** Flattened option for keyboard navigation (theme + animation). */
interface FlatOption {
    type: "theme" | "animation";
    value: string;
    label: string;
}

export default function SettingsButton({ buttonClassName }: SettingsButtonProps) {
    const { theme, setTheme, animationLevel, setAnimationLevel } = useSettings();
    const [open, setOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const themeOptions: { value: ThemeMode; label: string }[] = [
        { value: "light", label: "☀️ Light" },
        { value: "dark", label: "🌙 Dark" },
        { value: "system", label: "💻 System" },
    ];

    const animationOptions: { value: AnimationLevel; label: string }[] = [
        { value: "none", label: "None" },
        { value: "minimal", label: "Minimal" },
        { value: "all", label: "All" },
    ];

    const allOptions = useMemo<FlatOption[]>(
        () => [
            ...themeOptions.map((o) => ({ type: "theme" as const, value: o.value, label: o.label })),
            ...animationOptions.map((o) => ({ type: "animation" as const, value: o.value, label: o.label })),
        ],
        [],
    );

    const closeAndReturnFocus = useCallback(() => {
        setOpen(false);
        triggerRef.current?.focus();
    }, []);

    // When opening, focus the currently selected option
    useEffect(() => {
        if (!open) return;
        let idx = allOptions.findIndex((o) =>
            o.type === "theme" ? o.value === theme : o.value === animationLevel,
        );
        if (idx === -1) idx = 0;
        setFocusedIndex(idx);
        const id = requestAnimationFrame(() => {
            optionRefs.current[idx]?.focus();
        });
        return () => cancelAnimationFrame(id);
    }, [open, allOptions, theme, animationLevel]);

    // Keyboard navigation inside the dropdown
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopImmediatePropagation();
                closeAndReturnFocus();
                return;
            }
            if (e.key === "Tab") {
                e.preventDefault();
                e.stopImmediatePropagation();
                setFocusedIndex((prev) => {
                    const next = e.shiftKey
                        ? Math.max(prev - 1, 0)
                        : Math.min(prev + 1, allOptions.length - 1);
                    optionRefs.current[next]?.focus();
                    return next;
                });
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopImmediatePropagation();
                setFocusedIndex((prev) => {
                    const next = Math.min(prev + 1, allOptions.length - 1);
                    optionRefs.current[next]?.focus();
                    return next;
                });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopImmediatePropagation();
                setFocusedIndex((prev) => {
                    const next = Math.max(prev - 1, 0);
                    optionRefs.current[next]?.focus();
                    return next;
                });
            } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopImmediatePropagation();
                const opt = allOptions[focusedIndex];
                if (!opt) return;
                if (opt.type === "theme") {
                    setTheme(opt.value as ThemeMode);
                } else {
                    setAnimationLevel(opt.value as AnimationLevel);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown, true);
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [open, allOptions, focusedIndex, closeAndReturnFocus, setTheme, setAnimationLevel]);

    const isSelected = (opt: FlatOption) =>
        opt.type === "theme" ? opt.value === theme : opt.value === animationLevel;

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                onClick={() => setOpen((s) => !s)}
                aria-expanded={open}
                aria-haspopup="menu"
                className={buttonClassName ?? "rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
                title="Settings"
            >
                <CogIcon />
            </button>
            {open && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        data-overlay="true"
                        onClick={() => setOpen(false)}
                    />
                    <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-border bg-popover p-2 shadow-lg">
                        <div className="mb-2 px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Theme
                        </div>
                        {themeOptions.map((opt, idx) => {
                            const flatIdx = idx;
                            const selected = opt.value === theme;
                            return (
                                <button
                                    ref={(el) => {
                                        optionRefs.current[flatIdx] = el;
                                    }}
                                    key={opt.value}
                                    role="menuitemradio"
                                    aria-checked={selected}
                                    tabIndex={focusedIndex === flatIdx ? 0 : -1}
                                    onClick={() => setTheme(opt.value)}
                                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                                        selected
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-foreground hover:bg-accent"
                                    }`}
                                >
                                    <ThemeIcon theme={opt.value} />
                                    {opt.label}
                                </button>
                            );
                        })}
                        <div className="my-2 border-t border-border" />
                        <div className="mb-2 px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Animations
                        </div>
                        {animationOptions.map((opt, idx) => {
                            const flatIdx = themeOptions.length + idx;
                            const selected = opt.value === animationLevel;
                            return (
                                <button
                                    ref={(el) => {
                                        optionRefs.current[flatIdx] = el;
                                    }}
                                    key={opt.value}
                                    role="menuitemradio"
                                    aria-checked={selected}
                                    tabIndex={focusedIndex === flatIdx ? 0 : -1}
                                    onClick={() => setAnimationLevel(opt.value)}
                                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                                        selected
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-foreground hover:bg-accent"
                                    }`}
                                >
                                    <span className="w-3.5 text-center">
                                        {selected ? "●" : "○"}
                                    </span>
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ThemeMode } from "../../../shared/ask-user";
import { useSettings } from "../util/settings";
import {
    getDarkVariant,
    getLightVariant,
    getThemeDisplayName,
    getThemeFamilyById,
    getVariantForMode,
    type ThemeDefinition,
} from "../themes";

function PaletteIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.062a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.01 17.461 2 12 2z" />
        </svg>
    );
}

function ModeIcon({ mode }: { mode: ThemeMode }) {
    if (mode === "dark") return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.8 11.2A5.5 5.5 0 0 1 6.3 2.7 6.5 6.5 0 1 0 12.8 11.2z" />
        </svg>
    );
    if (mode === "light") return (
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

/** Color swatch using the theme's actual token colors */
function ThemeSwatch({ themeDef, isDark }: { themeDef: ThemeDefinition; isDark: boolean }) {
    const variant = isDark ? getDarkVariant(themeDef) : getLightVariant(themeDef);
    const tokens = variant?.tokens;
    const bg = tokens?.background ?? "#666";
    const primary = tokens?.primary ?? "#888";
    const accent = tokens?.accent ?? "#aaa";
    return (
        <div className="flex h-10 w-10 shrink-0 gap-0.5 rounded-md overflow-hidden ring-1 ring-border">
            <div className="flex-1" style={{ backgroundColor: bg }} />
            <div className="flex-1" style={{ backgroundColor: primary }} />
            <div className="flex-1" style={{ backgroundColor: accent }} />
        </div>
    );
}

interface SettingsButtonProps {
    buttonClassName?: string;
}

/** Flattened option for keyboard navigation. */
interface FlatOption {
    type: "theme" | "mode";
    value: string;
    label: string;
}

export default function SettingsButton({ buttonClassName }: SettingsButtonProps) {
    const {
        themeFamily,
        themeId,
        mode,
        resolvedMode,
        setThemeFamily,
        setMode,
        previewTheme,
        previewMode,
        endPreview,
        previewThemeId,
    } = useSettings();
    const [open, setOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const previewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const delayedEndPreview = useCallback(() => {
        if (previewTimeout.current) clearTimeout(previewTimeout.current);
        previewTimeout.current = setTimeout(() => endPreview(), 150);
    }, [endPreview]);

    const cancelDelayedEndPreview = useCallback(() => {
        if (previewTimeout.current) {
            clearTimeout(previewTimeout.current);
            previewTimeout.current = null;
        }
    }, []);

    const modeOptions: { value: ThemeMode; label: string }[] = [
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "system", label: "System" },
    ];
    const modeCount = modeOptions.length;

    // All themes now have dark/light pairs
    const allThemes = useMemo(() => {
        return [
            getThemeFamilyById("default")!,
            getThemeFamilyById("catppuccin")!,
            getThemeFamilyById("nord")!,
            getThemeFamilyById("tokyo-night")!,
            getThemeFamilyById("dracula")!,
            getThemeFamilyById("one-dark")!,
            getThemeFamilyById("ayu")!,
            getThemeFamilyById("github")!,
            getThemeFamilyById("night-owl")!,
            getThemeFamilyById("houston")!,
        ];
    }, []);

    // allOptions order: mode buttons first, then themes
    const allOptions = useMemo<FlatOption[]>(
        () => [
            ...modeOptions.map((o) => ({ type: "mode" as const, value: o.value, label: o.label })),
            ...allThemes.map((def) => ({
                type: "theme" as const,
                value: def.id,
                label: def.displayName,
            })),
        ],
        [allThemes],
    );

    const closeAndReturnFocus = useCallback(() => {
        setOpen(false);
        if (previewTimeout.current) clearTimeout(previewTimeout.current);
        endPreview();
        triggerRef.current?.focus();
    }, [endPreview]);

    // When opening, focus the currently selected mode or theme
    useEffect(() => {
        if (!open) return;
        let idx = allOptions.findIndex((o) =>
            o.type === "mode" ? o.value === mode : o.value === themeFamily,
        );
        if (idx === -1) idx = 0;
        setFocusedIndex(idx);
        const id = requestAnimationFrame(() => {
            optionRefs.current[idx]?.focus();
        });
        return () => cancelAnimationFrame(id);
    }, [open, allOptions, mode, themeFamily]);

    // Keyboard navigation
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
            } else if (e.key === "Home") {
                e.preventDefault();
                e.stopImmediatePropagation();
                setFocusedIndex(0);
                optionRefs.current[0]?.focus();
            } else if (e.key === "End") {
                e.preventDefault();
                e.stopImmediatePropagation();
                setFocusedIndex(allOptions.length - 1);
                optionRefs.current[allOptions.length - 1]?.focus();
            } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopImmediatePropagation();
                const opt = allOptions[focusedIndex];
                if (!opt) return;
                if (opt.type === "theme") {
                    const def = allThemes.find((d) => d.id === opt.value);
                    if (def) {
                        const target = getVariantForMode(def, resolvedMode === "dark");
                        if (target) {
                            setThemeFamily(def.id);
                            setOpen(false);
                        }
                    }
                } else {
                    setMode(opt.value as ThemeMode);
                    setOpen(false);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown, true);
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [open, allOptions, focusedIndex, closeAndReturnFocus, setThemeFamily, setMode, allThemes, resolvedMode]);

    const renderThemeTile = (def: ThemeDefinition, idx: number) => {
        const selected = def.id === themeFamily;
        return (
            <button
                ref={(el) => {
                    optionRefs.current[idx] = el;
                }}
                key={def.id}
                role="menuitemradio"
                aria-checked={selected}
                tabIndex={focusedIndex === idx ? 0 : -1}
                onFocus={() => {
                    cancelDelayedEndPreview();
                    previewTheme(def.id);
                }}
                onBlur={() => delayedEndPreview()}
                onMouseEnter={() => {
                    cancelDelayedEndPreview();
                    previewTheme(def.id);
                }}
                onMouseLeave={() => delayedEndPreview()}
                onClick={() => {
                    setThemeFamily(def.id);
                    setOpen(false);
                }}
                data-type="theme"
                className={`flex items-center gap-2 rounded-md p-1.5 text-xs transition-colors ${
                    selected
                        ? "bg-primary/10 text-primary font-medium ring-1 ring-primary"
                        : "text-foreground hover:bg-accent"
                }`}
                title={def.displayName}
            >
                <ThemeSwatch themeDef={def} isDark={resolvedMode === "dark"} />
                <span className="text-left leading-tight">
                    {def.displayName}
                </span>
            </button>
        );
    };

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                onClick={() => setOpen((s) => !s)}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-controls="settings-menu"
                className={buttonClassName ?? "rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"}
                title="Color palette"
            >
                <PaletteIcon />
            </button>
            {open && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        data-overlay="true"
                        onClick={() => {
                            setOpen(false);
                            if (previewTimeout.current) clearTimeout(previewTimeout.current);
                            endPreview();
                        }}
                    />
                    <div id="settings-menu" role="menu" className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-popover shadow-lg flex flex-col max-h-[420px]">
                        {/* ARIA live region for preview announcements */}
                        <div aria-live="polite" aria-atomic="true" className="sr-only">
                            {previewThemeId ? `Previewing ${getThemeDisplayName(previewThemeId)}` : ""}
                        </div>

                        {/* Mode bar at top */}
                        <div className="shrink-0 p-3 pb-2" role="group" aria-labelledby="mode-label">
                            <div id="mode-label" className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Mode
                            </div>
                            <div className="flex gap-1">
                                {modeOptions.map((opt, idx) => {
                                    const selected = opt.value === mode;
                                    return (
                                        <button
                                            ref={(el) => {
                                                optionRefs.current[idx] = el;
                                            }}
                                            key={opt.value}
                                            role="menuitemradio"
                                            aria-checked={selected}
                                            tabIndex={focusedIndex === idx ? 0 : -1}
                                            data-type="mode"
                                            onFocus={() => {
                                                cancelDelayedEndPreview();
                                                previewMode(opt.value);
                                            }}
                                            onBlur={() => delayedEndPreview()}
                                            onMouseEnter={() => {
                                                cancelDelayedEndPreview();
                                                previewMode(opt.value);
                                            }}
                                            onMouseLeave={() => delayedEndPreview()}
                                            onClick={() => {
                                                setMode(opt.value);
                                                setOpen(false);
                                            }}
                                            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors border cursor-pointer ${
                                                selected
                                                    ? "bg-primary/15 text-primary font-medium border-primary/50"
                                                    : "text-foreground hover:bg-accent border-transparent"
                                            }`}
                                        >
                                            <ModeIcon mode={opt.value} />
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="shrink-0 border-b border-border mx-3" />

                        {/* Scrollable palette area */}
                        <div className="flex-1 overflow-y-auto p-3 pt-2 shadow-[inset_0_-20px_16px_-16px_rgba(0,0,0,0.3)]" role="group" aria-labelledby="palette-label">
                            <div id="palette-label" className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Palette
                            </div>
                            <div className="flex flex-col">
                                {allThemes.map((def, idx) => renderThemeTile(def, modeCount + idx))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

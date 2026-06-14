import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ThemeMode } from "../../../shared/ask-user";
import { useSettings } from "../util/settings";
import {
    getDarkVariant,
    getLightVariant,
    getThemeDisplayName,
    getThemeFamilyById,
    getVariantForMode,
    hasDarkLightPairing,
    type ThemeDefinition,
} from "../themes";

function GearIcon() {
    return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    );
}

function ModeIcon({ mode }: { mode: ThemeMode }) {
    if (mode === "dark") return (
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.8 11.2A5.5 5.5 0 0 1 6.3 2.7 6.5 6.5 0 1 0 12.8 11.2z" />
        </svg>
    );
    if (mode === "light") return (
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.9 11.9l1.06 1.06M3.05 12.95l1.06-1.06M11.9 4.1l1.06-1.06" />
        </svg>
    );
    return (
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="12" height="10" rx="2" />
            <path d="M5 8h6" />
        </svg>
    );
}

function ZoomOutIcon() {
    return (
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 8h10" />
        </svg>
    );
}

function ZoomInIcon() {
    return (
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 8h10M8 3v10" />
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

interface ThemeSelectorProps {
    buttonClassName?: string;
}

/** Flattened option for keyboard navigation. */
interface FlatOption {
    type: "theme" | "mode";
    value: string;
    label: string;
}

export default function ThemeSelector({ buttonClassName }: ThemeSelectorProps) {
    const {
        themeFamily,
        mode,
        resolvedMode,
        contentZoom,
        zoomIn,
        zoomOut,
        resetZoom,
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
    const scrollContainerRef = useRef<HTMLDivElement>(null);
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

    // All themes now have dark/light pairs, sorted alphabetically by display name
    const allThemes = useMemo(() => {
        return [
            getThemeFamilyById("default")!,
            getThemeFamilyById("ayu")!,
            getThemeFamilyById("catppuccin")!,
            getThemeFamilyById("dracula")!,
            getThemeFamilyById("github")!,
            getThemeFamilyById("houston")!,
            getThemeFamilyById("night-owl")!,
            getThemeFamilyById("nord")!,
            getThemeFamilyById("one-dark")!,
            getThemeFamilyById("tokyo-night")!,
        ].sort((a, b) => a.displayName.localeCompare(b.displayName));
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

    // Check if a mode button is disabled (theme doesn't support mode switching)
    const isModeDisabled = useCallback((modeValue: string) => {
        const currentDef = getThemeFamilyById(themeFamily);
        if (!currentDef) return false;
        return !hasDarkLightPairing(currentDef);
    }, [themeFamily]);

    // Find the next focusable index, skipping disabled mode buttons
    const findNextFocusable = useCallback((start: number, direction: 1 | -1) => {
        let idx = start;
        const len = allOptions.length;
        for (let i = 0; i < len; i++) {
            idx = (idx + direction + len) % len;
            const opt = allOptions[idx];
            if (opt?.type === "theme") return idx;
            if (opt?.type === "mode" && !isModeDisabled(opt.value)) return idx;
        }
        return start;
    }, [allOptions, isModeDisabled]);

    // When opening, focus the currently selected mode or theme and scroll into view
    useEffect(() => {
        if (!open) return;
        let idx = allOptions.findIndex((o) =>
            o.type === "mode" ? o.value === mode : o.value === themeFamily,
        );
        // Skip disabled mode buttons
        const opt = allOptions[idx];
        if (opt?.type === "mode" && isModeDisabled(opt.value)) {
            idx = findNextFocusable(idx, 1);
        }
        if (idx === -1) idx = 0;
        setFocusedIndex(idx);
        const id = requestAnimationFrame(() => {
            const el = optionRefs.current[idx];
            el?.focus();
            el?.scrollIntoView({ block: "nearest" });
        });
        return () => cancelAnimationFrame(id);
    }, [open, allOptions, mode, themeFamily, isModeDisabled, findNextFocusable]);

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
                const direction = e.shiftKey ? -1 : 1;
                setFocusedIndex((prev) => {
                    const next = findNextFocusable(prev, direction as 1 | -1);
                    optionRefs.current[next]?.focus();
                    return next;
                });
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopImmediatePropagation();
                setFocusedIndex((prev) => {
                    const next = findNextFocusable(prev, 1);
                    optionRefs.current[next]?.focus();
                    return next;
                });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopImmediatePropagation();
                setFocusedIndex((prev) => {
                    const next = findNextFocusable(prev, -1);
                    optionRefs.current[next]?.focus();
                    return next;
                });
            } else if (e.key === "Home") {
                e.preventDefault();
                e.stopImmediatePropagation();
                const next = allOptions.findIndex((o) => o.type === "theme" || !isModeDisabled(o.value));
                const first = next >= 0 ? next : 0;
                setFocusedIndex(first);
                optionRefs.current[first]?.focus();
            } else if (e.key === "End") {
                e.preventDefault();
                e.stopImmediatePropagation();
                let last = allOptions.length - 1;
                while (last >= 0 && allOptions[last]?.type === "mode" && isModeDisabled(allOptions[last].value)) {
                    last--;
                }
                if (last < 0) last = allOptions.length - 1;
                setFocusedIndex(last);
                optionRefs.current[last]?.focus();
            } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopImmediatePropagation();
                const opt = allOptions[focusedIndex];
                if (!opt) return;
                if (opt.type === "mode" && isModeDisabled(opt.value)) return;
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
                    // Mode buttons do not close the dropdown
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown, true);
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [open, allOptions, focusedIndex, closeAndReturnFocus, setThemeFamily, setMode, allThemes, resolvedMode, isModeDisabled, findNextFocusable]);

    const renderThemeTile = (def: ThemeDefinition, idx: number) => {
        const selected = def.id === themeFamily;
        const supportsModeSwitching = hasDarkLightPairing(def);
        const hasSingleVariant = !supportsModeSwitching;
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
                        : hasSingleVariant
                            ? "text-muted-foreground opacity-60 cursor-pointer"
                            : "text-foreground hover:bg-accent"
                }`}
                title={hasSingleVariant ? `${def.displayName} — does not support mode switching` : def.displayName}
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
                title="Settings"
            >
                <GearIcon />
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
                                    const currentDef = getThemeFamilyById(themeFamily);
                                    const supportsModeSwitching = currentDef ? hasDarkLightPairing(currentDef) : false;
                                    const disabled = !supportsModeSwitching;
                                    return (
                                        <button
                                            ref={(el) => {
                                                optionRefs.current[idx] = el;
                                            }}
                                            key={opt.value}
                                            role="menuitemradio"
                                            aria-checked={selected}
                                            aria-disabled={disabled}
                                            tabIndex={disabled ? -1 : focusedIndex === idx ? 0 : -1}
                                            data-type="mode"
                                            disabled={disabled}
                                            onClick={() => {
                                                if (disabled) return;
                                                setMode(opt.value);
                                                // Mode buttons do not close the dropdown
                                            }}
                                            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors border ${
                                                disabled
                                                    ? "opacity-50 cursor-not-allowed text-muted-foreground border-transparent"
                                                    : selected
                                                        ? "bg-primary/15 text-primary font-medium border-primary/50 cursor-pointer"
                                                        : "text-foreground hover:bg-accent border-transparent cursor-pointer"
                                            }`}
                                            title={disabled ? "This palette does not support mode switching" : undefined}
                                        >
                                            <ModeIcon mode={opt.value} />
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>


                        <div className="shrink-0 border-b border-border mx-3" />

                        {/* Content zoom controls */}
                        <div className="shrink-0 p-3 py-2" role="group" aria-labelledby="zoom-label">
                            <div id="zoom-label" className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Zoom
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={zoomOut}
                                    className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={contentZoom <= 50}
                                    aria-label="Zoom out"
                                    title="Zoom out (⌘/Ctrl -)"
                                >
                                    <ZoomOutIcon />
                                </button>
                                <button
                                    type="button"
                                    onClick={resetZoom}
                                    className="flex h-8 flex-1 items-center justify-center rounded-md border border-border px-2 text-xs font-medium text-foreground hover:bg-accent"
                                    aria-label={`Reset zoom from ${contentZoom}% to 100%`}
                                    title="Reset zoom (⌘/Ctrl 0)"
                                >
                                    {contentZoom}%
                                </button>
                                <button
                                    type="button"
                                    onClick={zoomIn}
                                    className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={contentZoom >= 250}
                                    aria-label="Zoom in"
                                    title="Zoom in (⌘/Ctrl +)"
                                >
                                    <ZoomInIcon />
                                </button>
                            </div>
                        </div>

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

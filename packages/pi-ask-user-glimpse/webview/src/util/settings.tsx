import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AnimationLevel, ThemeMode } from "../../../shared/ask-user";
import {
    getThemeDataAttribute,
    resolveThemeConfig,
    getThemeFamilyById,
    getVariantForMode,
    getThemeFamilyId,
    type ThemeId,
    type ThemeFamilyId,
} from "../themes";

/* ── System Appearance Detection ── */

export function getSystemMode(): "light" | "dark" {
    if (typeof window === "undefined") return "light";
    try {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    } catch {
        return "light";
    }
}

/* ── Persistence ── */

const THEME_FAMILY_KEY = "pi-ask-user-glimpse:theme-family";
const MODE_KEY = "pi-ask-user-glimpse:mode";

function loadSavedThemeFamily(): ThemeFamilyId | null {
    try {
        const familyRaw = localStorage.getItem(THEME_FAMILY_KEY);
        if (familyRaw) {
            const def = getThemeFamilyById(familyRaw);
            if (def) return familyRaw;
        }
        const oldRaw = localStorage.getItem("pi-ask-user-glimpse:theme");
        if (oldRaw) {
            const family = getThemeFamilyId(oldRaw);
            if (family) return family;
        }
    } catch {
        // ignore
    }
    return null;
}

function loadSavedMode(): ThemeMode | null {
    try {
        const raw = localStorage.getItem(MODE_KEY);
        if (raw && (raw === "light" || raw === "dark" || raw === "system")) {
            return raw;
        }
    } catch {
        // ignore
    }
    return null;
}

function saveThemeFamily(family: ThemeFamilyId) {
    try {
        localStorage.setItem(THEME_FAMILY_KEY, family);
    } catch {
        // ignore
    }
}

function saveMode(mode: ThemeMode) {
    try {
        localStorage.setItem(MODE_KEY, mode);
    } catch {
        // ignore
    }
}

/* ── Context Type ── */

export interface SettingsState {
    themeFamily: ThemeFamilyId;
    themeId: ThemeId;
    mode: ThemeMode;
    resolvedMode: "light" | "dark";
    animationLevel: AnimationLevel;
    setThemeFamily: (family: ThemeFamilyId) => void;
    setMode: (mode: ThemeMode) => void;
    setAnimationLevel: (level: AnimationLevel) => void;
    previewTheme: (family: ThemeFamilyId) => void;
    previewMode: (mode: ThemeMode) => void;
    endPreview: () => void;
    previewThemeId: ThemeId | null;
}

const SettingsContext = createContext<SettingsState | null>(null);

export function useSettings(): SettingsState {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings must be inside SettingsProvider");
    return ctx;
}

/* ── Ref-based snapshot for non-React sendToGlimpse() ── */

const settingsRef = {
    currentThemeId: "tokyo-night" as ThemeId,
    currentMode: "system" as ThemeMode,
    currentAnimationLevel: "all" as AnimationLevel,
};

export function getCurrentMode(): ThemeMode {
    return settingsRef.currentMode;
}

export function getCurrentAnimationLevel(): AnimationLevel {
    return settingsRef.currentAnimationLevel;
}

export function getCurrentThemeName(): ThemeId {
    return settingsRef.currentThemeId;
}

interface SettingsProviderProps {
    initialThemeFamily?: ThemeFamilyId;
    initialMode?: ThemeMode;
    initialAnimationLevel?: AnimationLevel;
    children: React.ReactNode;
}

export function SettingsProvider({
    initialThemeFamily,
    initialMode,
    initialAnimationLevel,
    children,
}: SettingsProviderProps) {
    const [themeFamily, setThemeFamilyState] = useState<ThemeFamilyId>(
        initialThemeFamily ?? loadSavedThemeFamily() ?? "tokyo-night",
    );
    const [mode, setModeState] = useState<ThemeMode>(
        initialMode ?? loadSavedMode() ?? "system",
    );
    const [animationLevel, setAnimationLevelState] = useState<AnimationLevel>(
        initialAnimationLevel ?? "all",
    );
    const [previewThemeFamily, setPreviewThemeFamily] = useState<ThemeFamilyId | null>(null);
    const [previewModeValue, setPreviewModeValue] = useState<ThemeMode | null>(null);

    // Derive the concrete theme variant from family + mode
    const effectiveThemeFamily = previewThemeFamily ?? themeFamily;
    const effectiveMode = previewModeValue ?? mode;
    const preferDark = effectiveMode === "system" ? getSystemMode() === "dark" : effectiveMode === "dark";
    const def = getThemeFamilyById(effectiveThemeFamily);
    const variant = def ? getVariantForMode(def, preferDark) : null;
    const themeId = variant?.id ?? ("dark" as ThemeId);
    const resolvedMode = resolveThemeConfig({ name: themeId, mode: effectiveMode }).resolvedMode;

    // Apply theme to DOM
    useEffect(() => {
        const root = document.documentElement;
        const dataAttr = getThemeDataAttribute(themeId);

        root.setAttribute("data-theme", dataAttr);

        if (resolvedMode === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }

        notifyIframeThemeChange();
    }, [themeId, resolvedMode]);

    // System appearance listener
    useEffect(() => {
        let mq: MediaQueryList | null = null;
        try {
            mq = window.matchMedia("(prefers-color-scheme: dark)");
        } catch {
            return;
        }

        const listener = (e: MediaQueryListEvent) => {
            if (effectiveMode === "system") {
                const root = document.documentElement;
                if (e.matches) {
                    root.classList.add("dark");
                } else {
                    root.classList.remove("dark");
                }
                notifyIframeThemeChange();
            }
        };

        mq.addEventListener("change", listener);
        return () => mq?.removeEventListener("change", listener);
    }, [effectiveMode]);

    // Sync ref-based snapshots synchronously
    settingsRef.currentThemeId = themeId;
    settingsRef.currentMode = mode;
    settingsRef.currentAnimationLevel = animationLevel;

    const setThemeFamily = (family: ThemeFamilyId) => {
        setThemeFamilyState(family);
        saveThemeFamily(family);
    };

    const setMode = (m: ThemeMode) => {
        setModeState(m);
        saveMode(m);
    };

    const setAnimationLevel = (level: AnimationLevel) => {
        setAnimationLevelState(level);
        settingsRef.currentAnimationLevel = level;
    };

    const previewTheme = (family: ThemeFamilyId) => {
        setPreviewThemeFamily(family);
    };

    const previewMode = (m: ThemeMode) => {
        setPreviewModeValue(m);
    };

    const endPreview = () => {
        setPreviewThemeFamily(null);
        setPreviewModeValue(null);
    };

    // Compute preview theme id for aria-live
    const previewThemeId = useMemo(() => {
        if (previewThemeFamily === null && previewModeValue === null) return null;
        const pFamily = previewThemeFamily ?? themeFamily;
        const pMode = previewModeValue ?? mode;
        const pDark = pMode === "system" ? getSystemMode() === "dark" : pMode === "dark";
        const pDef = getThemeFamilyById(pFamily);
        const pVariant = pDef ? getVariantForMode(pDef, pDark) : null;
        return pVariant?.id ?? null;
    }, [previewThemeFamily, previewModeValue, themeFamily, mode]);

    return (
        <SettingsContext.Provider
            value={{
                themeFamily,
                themeId,
                mode,
                resolvedMode,
                animationLevel,
                setThemeFamily,
                setMode,
                setAnimationLevel,
                previewTheme,
                previewMode,
                endPreview,
                previewThemeId,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
}

import { THEME_CSS_VARS } from "../themes/types.js";

/* ── Iframe Theme Notification ── */

function notifyIframeThemeChange() {
    const iframes = document.querySelectorAll<HTMLIFrameElement>(
        "iframe[data-context-panel]",
    );
    iframes.forEach((iframe) => {
        const root = document.documentElement;
        const computed = getComputedStyle(root);
        const vars: Record<string, string> = {};

        for (const name of THEME_CSS_VARS) {
            vars[`--${name}`] = computed.getPropertyValue(`--${name}`).trim();
        }

        iframe.contentWindow?.postMessage(
            {
                type: "THEME_CHANGED",
                cssVars: vars,
                isDark: root.classList.contains("dark"),
            },
            "*",
        );
    });
}

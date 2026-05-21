import { createContext, useContext, useEffect, useState } from "react";
import type { AnimationLevel, ThemeMode } from "../../../shared/ask-user";

function getSystemTheme(): "light" | "dark" {
    if (typeof window === "undefined") return "light";
    try {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    } catch {
        return "light";
    }
}

function resolveTheme(theme: ThemeMode): "light" | "dark" {
    if (theme === "system") return getSystemTheme();
    return theme;
}

export interface SettingsState {
    theme: ThemeMode;
    resolvedTheme: "light" | "dark";
    animationLevel: AnimationLevel;
    setTheme: (theme: ThemeMode) => void;
    setAnimationLevel: (level: AnimationLevel) => void;
}

const SettingsContext = createContext<SettingsState | null>(null);

export function useSettings(): SettingsState {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings must be inside SettingsProvider");
    return ctx;
}

/* ── Module-level snapshot for non-React sendToGlimpse() ── */

let _currentTheme: ThemeMode = "system";
let _currentAnimationLevel: AnimationLevel = "all";

export function getCurrentTheme(): ThemeMode {
    return _currentTheme;
}

export function getCurrentAnimationLevel(): AnimationLevel {
    return _currentAnimationLevel;
}

interface SettingsProviderProps {
    initialTheme?: ThemeMode;
    initialAnimationLevel?: AnimationLevel;
    children: React.ReactNode;
}

export function SettingsProvider({
    initialTheme,
    initialAnimationLevel,
    children,
}: SettingsProviderProps) {
    const [theme, setThemeState] = useState<ThemeMode>(
        initialTheme ?? "system",
    );
    const [animationLevel, setAnimationLevelState] = useState<AnimationLevel>(
        initialAnimationLevel ?? "all",
    );

    const resolvedTheme = resolveTheme(theme);

    // Sync module-level snapshot whenever state changes
    useEffect(() => {
        _currentTheme = theme;
    }, [theme]);

    useEffect(() => {
        _currentAnimationLevel = animationLevel;
    }, [animationLevel]);

    useEffect(() => {
        const root = document.documentElement;
        if (resolvedTheme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, [resolvedTheme]);

    useEffect(() => {
        const listener = (e: MediaQueryListEvent) => {
            if (theme === "system") {
                const root = document.documentElement;
                if (e.matches) {
                    root.classList.add("dark");
                } else {
                    root.classList.remove("dark");
                }
            }
        };
        try {
            const mq = window.matchMedia("(prefers-color-scheme: dark)");
            mq.addEventListener("change", listener);
            return () => mq.removeEventListener("change", listener);
        } catch {
            return;
        }
    }, [theme]);

    const setTheme = (t: ThemeMode) => {
        setThemeState(t);
        _currentTheme = t;
    };

    const setAnimationLevel = (level: AnimationLevel) => {
        setAnimationLevelState(level);
        _currentAnimationLevel = level;
    };

    return (
        <SettingsContext.Provider
            value={{ theme, resolvedTheme, animationLevel, setTheme, setAnimationLevel }}
        >
            {children}
        </SettingsContext.Provider>
    );
}

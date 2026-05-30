import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { useSettings, SettingsProvider } from "../settings";
import type { ThemeMode, AnimationLevel } from "../../../../shared/ask-user";

function TestConsumer() {
    const { themeFamily, themeId, mode, resolvedMode, animationLevel, setThemeFamily, setMode, setAnimationLevel } = useSettings();
    return (
        <div>
            <div data-testid="theme-family">{themeFamily}</div>
            <div data-testid="theme-id">{themeId}</div>
            <div data-testid="mode">{mode}</div>
            <div data-testid="resolved">{resolvedMode}</div>
            <div data-testid="animation">{animationLevel}</div>
            <button data-testid="set-dark" onClick={() => { setThemeFamily("default"); setMode("dark"); }}>
                Dark
            </button>
            <button data-testid="set-light" onClick={() => { setThemeFamily("default"); setMode("light"); }}>
                Light
            </button>
            <button data-testid="set-system" onClick={() => setMode("system")}>
                System
            </button>
            <button data-testid="set-tokyo" onClick={() => setThemeFamily("tokyo-night")}>
                Tokyo Night
            </button>
            <button data-testid="set-minimal" onClick={() => setAnimationLevel("minimal")}>
                Minimal
            </button>
            <button data-testid="set-none" onClick={() => setAnimationLevel("none")}>
                None
            </button>
        </div>
    );
}

function wrapper({ children }: { children: React.ReactNode }) {
    return <SettingsProvider>{children}</SettingsProvider>;
}

describe("useSettings", () => {
    it("returns default theme and animation level", () => {
        const { result } = renderHook(() => useSettings(), { wrapper });
        expect(result.current.themeFamily).toBe("default");
        // jsdom has no prefers-color-scheme, so system mode resolves to light
        expect(result.current.themeId).toBe("light");
        expect(result.current.mode).toBe("system");
        expect(result.current.animationLevel).toBe("all");
    });

    it("throws when used outside SettingsProvider", () => {
        expect(() => {
            renderHook(() => useSettings());
        }).toThrow("useSettings must be inside SettingsProvider");
    });
});

describe("SettingsProvider", () => {
    it("renders children", () => {
        render(
            <SettingsProvider>
                <div data-testid="child">Hello</div>
            </SettingsProvider>,
        );
        expect(screen.getByTestId("child")).toHaveTextContent("Hello");
    });

    it("uses initialThemeFamily and initialMode", () => {
        render(
            <SettingsProvider initialThemeFamily="default" initialMode="dark" initialAnimationLevel="none">
                <TestConsumer />
            </SettingsProvider>,
        );
        expect(screen.getByTestId("theme-family")).toHaveTextContent("default");
        expect(screen.getByTestId("theme-id")).toHaveTextContent("dark");
        expect(screen.getByTestId("mode")).toHaveTextContent("dark");
        expect(screen.getByTestId("animation")).toHaveTextContent("none");
    });

    it("theme can be changed via setThemeFamily", () => {
        render(
            <SettingsProvider initialMode="dark">
                <TestConsumer />
            </SettingsProvider>,
        );
        expect(screen.getByTestId("theme-family")).toHaveTextContent("default");
        expect(screen.getByTestId("theme-id")).toHaveTextContent("dark");
        fireEvent.click(screen.getByTestId("set-tokyo"));
        expect(screen.getByTestId("theme-family")).toHaveTextContent("tokyo-night");
        expect(screen.getByTestId("theme-id")).toHaveTextContent("tokyo-night");
    });

    it("mode can be changed via setMode", () => {
        render(
            <SettingsProvider initialMode="system">
                <TestConsumer />
            </SettingsProvider>,
        );
        expect(screen.getByTestId("mode")).toHaveTextContent("system");
        fireEvent.click(screen.getByTestId("set-dark"));
        expect(screen.getByTestId("mode")).toHaveTextContent("dark");
        expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
        fireEvent.click(screen.getByTestId("set-light"));
        expect(screen.getByTestId("mode")).toHaveTextContent("light");
        expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    });

    it("animation level can be changed via setAnimationLevel", () => {
        render(
            <SettingsProvider>
                <TestConsumer />
            </SettingsProvider>,
        );
        expect(screen.getByTestId("animation")).toHaveTextContent("all");
        fireEvent.click(screen.getByTestId("set-minimal"));
        expect(screen.getByTestId("animation")).toHaveTextContent("minimal");
        fireEvent.click(screen.getByTestId("set-none"));
        expect(screen.getByTestId("animation")).toHaveTextContent("none");
    });

    it("resolvedMode is computed from system mode", () => {
        render(
            <SettingsProvider initialMode="system">
                <TestConsumer />
            </SettingsProvider>,
        );
        // jsdom has no prefers-color-scheme, so getSystemMode returns "light"
        expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    });

    it("updates document root class on theme change", () => {
        render(
            <SettingsProvider>
                <TestConsumer />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTestId("set-dark"));
        expect(document.documentElement.classList.contains("dark")).toBe(true);
        fireEvent.click(screen.getByTestId("set-light"));
        expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("handles matchMedia errors gracefully", () => {
        const originalMatchMedia = window.matchMedia;
        window.matchMedia = () => {
            throw new Error("matchMedia not supported");
        };
        // Should not throw during render
        render(
            <SettingsProvider initialMode="system">
                <TestConsumer />
            </SettingsProvider>,
        );
        expect(screen.getByTestId("resolved")).toHaveTextContent("light");
        window.matchMedia = originalMatchMedia;
    });
});

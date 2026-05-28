import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { useSettings, SettingsProvider } from "../settings";
import type { ThemeMode, AnimationLevel } from "../../../../shared/ask-user";

function TestConsumer() {
    const { theme, resolvedTheme, animationLevel, setTheme, setAnimationLevel } = useSettings();
    return (
        <div>
            <div data-testid="theme">{theme}</div>
            <div data-testid="resolved">{resolvedTheme}</div>
            <div data-testid="animation">{animationLevel}</div>
            <button data-testid="set-dark" onClick={() => setTheme("dark")}>
                Dark
            </button>
            <button data-testid="set-light" onClick={() => setTheme("light")}>
                Light
            </button>
            <button data-testid="set-system" onClick={() => setTheme("system")}>
                System
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
        expect(result.current.theme).toBe("system");
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

    it("uses initialTheme and initialAnimationLevel", () => {
        render(
            <SettingsProvider initialTheme="dark" initialAnimationLevel="none">
                <TestConsumer />
            </SettingsProvider>,
        );
        expect(screen.getByTestId("theme")).toHaveTextContent("dark");
        expect(screen.getByTestId("animation")).toHaveTextContent("none");
    });

    it("theme can be changed via setTheme", () => {
        render(
            <SettingsProvider>
                <TestConsumer />
            </SettingsProvider>,
        );
        expect(screen.getByTestId("theme")).toHaveTextContent("system");
        fireEvent.click(screen.getByTestId("set-dark"));
        expect(screen.getByTestId("theme")).toHaveTextContent("dark");
        expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
        fireEvent.click(screen.getByTestId("set-light"));
        expect(screen.getByTestId("theme")).toHaveTextContent("light");
        expect(screen.getByTestId("resolved")).toHaveTextContent("light");
        fireEvent.click(screen.getByTestId("set-system"));
        expect(screen.getByTestId("theme")).toHaveTextContent("system");
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

    it("resolvedTheme is computed from system theme", () => {
        render(
            <SettingsProvider initialTheme="system">
                <TestConsumer />
            </SettingsProvider>,
        );
        // jsdom has no prefers-color-scheme, so getSystemTheme returns "light"
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
});

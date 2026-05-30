import { describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { SettingsProvider, useSettings } from "../settings";

function TestComponent() {
    const { mode } = useSettings();
    return <div data-testid="mode">{mode}</div>;
}

describe("SettingsProvider matchMedia", () => {
    it("listens to system theme changes", () => {
        const addEventListener = vi.fn();
        const removeEventListener = vi.fn();
        const mockMq = { addEventListener, removeEventListener, matches: false };
        window.matchMedia = vi.fn(() => mockMq as unknown as MediaQueryList);

        render(
            <SettingsProvider initialMode="system">
                <TestComponent />
            </SettingsProvider>,
        );

        expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
        expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("updates dark class when matchMedia listener fires", () => {
        let listener: ((e: { matches: boolean }) => void) | null = null;
        const addEventListener = vi.fn((_, cb) => {
            listener = cb;
        });
        const removeEventListener = vi.fn();
        const mockMq = { addEventListener, removeEventListener, matches: false };
        window.matchMedia = vi.fn(() => mockMq as unknown as MediaQueryList);

        render(
            <SettingsProvider initialMode="system">
                <TestComponent />
            </SettingsProvider>,
        );

        expect(listener).toBeTruthy();
        expect(document.documentElement.classList.contains("dark")).toBe(false);

        act(() => {
            listener!({ matches: true });
        });
        expect(document.documentElement.classList.contains("dark")).toBe(true);

        act(() => {
            listener!({ matches: false });
        });
        expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
});

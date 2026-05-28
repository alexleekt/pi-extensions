import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { SettingsProvider, useSettings } from "../settings";

function TestComponent() {
    const { theme } = useSettings();
    return <div data-testid="theme">{theme}</div>;
}

describe("SettingsProvider matchMedia", () => {
    it("listens to system theme changes", () => {
        const addEventListener = vi.fn();
        const removeEventListener = vi.fn();
        const mockMq = { addEventListener, removeEventListener, matches: false };
        window.matchMedia = vi.fn(() => mockMq as unknown as MediaQueryList);

        render(
            <SettingsProvider initialTheme="system">
                <TestComponent />
            </SettingsProvider>,
        );

        expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
        expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });
});

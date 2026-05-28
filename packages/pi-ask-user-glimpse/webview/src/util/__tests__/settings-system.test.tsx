import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { SettingsProvider, useSettings } from "../settings";

function TestComponent() {
    const { resolvedTheme } = useSettings();
    return <div data-testid="theme">{resolvedTheme}</div>;
}

describe("SettingsProvider system theme", () => {
    it("defaults to light when matchMedia is not available", () => {
        const originalMatchMedia = window.matchMedia;
        window.matchMedia = vi.fn(() => {
            throw new Error("matchMedia not supported");
        }) as unknown as typeof window.matchMedia;

        const { getByTestId } = render(
            <SettingsProvider initialTheme="system">
                <TestComponent />
            </SettingsProvider>,
        );

        expect(getByTestId("theme")).toHaveTextContent("light");
        window.matchMedia = originalMatchMedia;
    });
});

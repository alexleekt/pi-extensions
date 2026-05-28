import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SettingsButton from "../SettingsButton";
import { SettingsProvider } from "../../util/settings";

vi.mock("../../util/settings", async () => {
    const actual = await vi.importActual<typeof import("../../util/settings")>("../../util/settings");
    return {
        ...actual,
        useSettings: () => ({
            theme: "system" as const,
            resolvedTheme: "light" as const,
            animationLevel: "all" as const,
            setTheme: vi.fn(),
            setAnimationLevel: vi.fn(),
        }),
    };
});

describe("SettingsButton", () => {
    it("renders the settings trigger", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        expect(screen.getByTitle("Settings")).toBeInTheDocument();
    });

    it("opens dropdown on click", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Settings"));
        expect(screen.getByText("Theme")).toBeInTheDocument();
        expect(screen.getByText("Animations")).toBeInTheDocument();
    });

    it("closes dropdown on Escape", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Settings"));
        expect(screen.getByText("Theme")).toBeInTheDocument();
        fireEvent.keyDown(window, { key: "Escape" });
        expect(screen.queryByText("Theme")).not.toBeInTheDocument();
    });
});

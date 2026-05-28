import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SettingsButton from "../SettingsButton";
import { SettingsProvider } from "../../util/settings";

const mockState = vi.hoisted(() => {
    const state = {
        theme: "system" as const,
        animationLevel: "all" as const,
    };
    return {
        get theme() { return state.theme; },
        set theme(v: string) { state.theme = v as any; },
        get animationLevel() { return state.animationLevel; },
        set animationLevel(v: string) { state.animationLevel = v as any; },
        setTheme: vi.fn((v: string) => { state.theme = v as any; }),
        setAnimationLevel: vi.fn((v: string) => { state.animationLevel = v as any; }),
    };
});

vi.mock("../../util/settings", async () => {
    const actual = await vi.importActual<typeof import("../../util/settings")>("../../util/settings");
    return {
        ...actual,
        useSettings: () => ({
            get theme() { return mockState.theme; },
            resolvedTheme: "light" as const,
            get animationLevel() { return mockState.animationLevel; },
            setTheme: mockState.setTheme,
            setAnimationLevel: mockState.setAnimationLevel,
        }),
    };
});

beforeEach(() => {
    mockState.theme = "system";
    mockState.animationLevel = "all";
    mockState.setTheme.mockClear();
    mockState.setAnimationLevel.mockClear();
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

    it("closes dropdown on Escape and returns focus to trigger", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        const trigger = screen.getByTitle("Settings");
        fireEvent.click(trigger);
        expect(screen.getByText("Theme")).toBeInTheDocument();
        fireEvent.keyDown(window, { key: "Escape" });
        expect(screen.queryByText("Theme")).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it("theme selection updates dropdown", () => {
        const { rerender } = render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Settings"));
        const options = screen.getAllByRole("menuitemradio");
        const darkOption = options.find((el) => el.textContent?.includes("Dark"));
        expect(darkOption).toBeTruthy();
        fireEvent.click(darkOption!);
        expect(mockState.setTheme).toHaveBeenCalledWith("dark");

        rerender(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        const optionsAfter = screen.getAllByRole("menuitemradio");
        const darkOptionAfter = optionsAfter.find((el) => el.textContent?.includes("Dark"));
        expect(darkOptionAfter).toHaveAttribute("aria-checked", "true");
    });

    it("animation level selection updates dropdown", () => {
        const { rerender } = render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Settings"));
        const options = screen.getAllByRole("menuitemradio");
        const minimalOption = options.find((el) => el.textContent?.includes("Minimal"));
        expect(minimalOption).toBeTruthy();
        fireEvent.click(minimalOption!);
        expect(mockState.setAnimationLevel).toHaveBeenCalledWith("minimal");

        rerender(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        const optionsAfter = screen.getAllByRole("menuitemradio");
        const minimalOptionAfter = optionsAfter.find((el) => el.textContent?.includes("Minimal"));
        expect(minimalOptionAfter).toHaveAttribute("aria-checked", "true");
    });

    it("ArrowDown navigates options in dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Settings"));
        const options = screen.getAllByRole("menuitemradio");
        // Initially focused on "System" (index 2)
        expect(options[2]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: "ArrowDown" });
        // Now focused on "None" animation (index 3)
        expect(options[3]).toHaveAttribute("tabIndex", "0");
        expect(options[2]).toHaveAttribute("tabIndex", "-1");
    });

    it("ArrowUp navigates options in dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Settings"));
        const options = screen.getAllByRole("menuitemradio");
        // Initially focused on "System" (index 2)
        expect(options[2]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: "ArrowUp" });
        // Now focused on "Dark" (index 1)
        expect(options[1]).toHaveAttribute("tabIndex", "0");
        expect(options[2]).toHaveAttribute("tabIndex", "-1");
    });

    it("Enter selects option in dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Settings"));
        const options = screen.getAllByRole("menuitemradio");

        // Navigate to "Dark" (index 1)
        fireEvent.keyDown(window, { key: "ArrowUp" });
        expect(options[1]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: "Enter" });
        expect(mockState.setTheme).toHaveBeenCalledWith("dark");
    });

    it("Space selects option in dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Settings"));
        const options = screen.getAllByRole("menuitemradio");

        // Navigate to "Dark" (index 1)
        fireEvent.keyDown(window, { key: "ArrowUp" });
        expect(options[1]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: " " });
        expect(mockState.setTheme).toHaveBeenCalledWith("dark");
    });

    it("Tab cycles forward through options in dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Settings"));
        const options = screen.getAllByRole("menuitemradio");
        // Initially focused on "System" (index 2)
        expect(options[2]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: "Tab" });
        expect(options[3]).toHaveAttribute("tabIndex", "0");
        expect(options[2]).toHaveAttribute("tabIndex", "-1");
    });

    it("Shift+Tab cycles backward through options in dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Settings"));
        const options = screen.getAllByRole("menuitemradio");
        // Initially focused on "System" (index 2)
        expect(options[2]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
        expect(options[1]).toHaveAttribute("tabIndex", "0");
        expect(options[2]).toHaveAttribute("tabIndex", "-1");
    });

    it("Enter selects animation option in dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Settings"));
        const options = screen.getAllByRole("menuitemradio");

        // Navigate to "Minimal" animation (index 4)
        fireEvent.keyDown(window, { key: "ArrowDown" });
        fireEvent.keyDown(window, { key: "ArrowDown" });
        expect(options[4]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: "Enter" });
        expect(mockState.setAnimationLevel).toHaveBeenCalledWith("minimal");
    });

    it("dropdown closes when clicking outside", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Settings"));
        expect(screen.getByText("Theme")).toBeInTheDocument();

        const backdrop = document.querySelector('[data-overlay="true"]');
        expect(backdrop).toBeInTheDocument();
        fireEvent.click(backdrop!);
        expect(screen.queryByText("Theme")).not.toBeInTheDocument();
    });

    it("aria-checked updates when selection changes", () => {
        const { rerender } = render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Settings"));
        const options = screen.getAllByRole("menuitemradio");
        const lightOption = options.find((el) => el.textContent?.includes("Light"));
        const darkOption = options.find((el) => el.textContent?.includes("Dark"));
        const systemOption = options.find((el) => el.textContent?.includes("System"));

        expect(lightOption).toHaveAttribute("aria-checked", "false");
        expect(darkOption).toHaveAttribute("aria-checked", "false");
        expect(systemOption).toHaveAttribute("aria-checked", "true");

        fireEvent.click(darkOption!);
        expect(mockState.setTheme).toHaveBeenCalledWith("dark");

        rerender(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        const optionsAfter = screen.getAllByRole("menuitemradio");
        const darkOptionAfter = optionsAfter.find((el) => el.textContent?.includes("Dark"));
        const systemOptionAfter = optionsAfter.find((el) => el.textContent?.includes("System"));
        expect(darkOptionAfter).toHaveAttribute("aria-checked", "true");
        expect(systemOptionAfter).toHaveAttribute("aria-checked", "false");
    });
});

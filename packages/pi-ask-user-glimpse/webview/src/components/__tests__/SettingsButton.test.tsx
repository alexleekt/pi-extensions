import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SettingsButton from "../SettingsButton";
import { SettingsProvider } from "../../util/settings";

const mockState = vi.hoisted(() => {
    const state = {
        themeFamily: "default" as const,
        themeId: "dark" as const,
        mode: "dark" as const,
    };
    return {
        get themeFamily() { return state.themeFamily; },
        set themeFamily(v: string) { state.themeFamily = v as any; },
        get themeId() { return state.themeId; },
        set themeId(v: string) { state.themeId = v as any; },
        get mode() { return state.mode; },
        set mode(v: string) { state.mode = v as any; },
        setThemeFamily: vi.fn((v: string) => { state.themeFamily = v as any; }),
        setMode: vi.fn((v: string) => { state.mode = v as any; }),
    };
});

vi.mock("../../util/settings", async () => {
    const actual = await vi.importActual<typeof import("../../util/settings")>("../../util/settings");
    return {
        ...actual,
        useSettings: () => ({
            get themeFamily() { return mockState.themeFamily; },
            get themeId() { return mockState.themeId; },
            get mode() { return mockState.mode; },
            resolvedMode: "dark" as const,
            setThemeFamily: mockState.setThemeFamily,
            setMode: mockState.setMode,
            previewTheme: vi.fn(),
            previewMode: vi.fn(),
            endPreview: vi.fn(),
            previewThemeId: null,
        }),
    };
});

beforeEach(() => {
    mockState.themeFamily = "default";
    mockState.themeId = "dark";
    mockState.mode = "dark";
    mockState.setThemeFamily.mockClear();
    mockState.setMode.mockClear();
});

describe("SettingsButton", () => {
    it("renders the palette trigger", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        expect(screen.getByTitle("Color palette")).toBeInTheDocument();
    });

    it("opens dropdown on click", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        expect(screen.getByText("Palette")).toBeInTheDocument();
        expect(screen.getByText("Mode")).toBeInTheDocument();
    });

    it("closes dropdown on Escape and returns focus to trigger", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        const trigger = screen.getByTitle("Color palette");
        fireEvent.click(trigger);
        expect(screen.getByText("Palette")).toBeInTheDocument();
        fireEvent.keyDown(window, { key: "Escape" });
        expect(screen.queryByText("Palette")).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it("shows all themes with dark/light pairs", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        const options = screen.getAllByRole("menuitemradio");
        const themes = options.filter((el) => el.getAttribute("data-type") === "theme");
        expect(themes.length).toBe(10);
        expect(themes.some((el) => el.textContent?.includes("Default"))).toBe(true);
        expect(themes.some((el) => el.textContent?.includes("Catppuccin"))).toBe(true);
        expect(themes.some((el) => el.textContent?.includes("Nord"))).toBe(true);
        expect(themes.some((el) => el.textContent?.includes("Tokyo Night"))).toBe(true);
        expect(themes.some((el) => el.textContent?.includes("Dracula"))).toBe(true);
        expect(themes.some((el) => el.textContent?.includes("One Dark"))).toBe(true);
        expect(themes.some((el) => el.textContent?.includes("Ayu"))).toBe(true);
        expect(themes.some((el) => el.textContent?.includes("GitHub"))).toBe(true);
        expect(themes.some((el) => el.textContent?.includes("Night Owl"))).toBe(true);
        expect(themes.some((el) => el.textContent?.includes("Houston"))).toBe(true);
    });

    it("mode selection updates dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        const options = screen.getAllByRole("menuitemradio");
        const lightOption = options.find((el) => el.getAttribute("data-type") === "mode" && el.textContent?.includes("Light"));
        expect(lightOption).toBeTruthy();
        fireEvent.click(lightOption!);
        expect(mockState.setMode).toHaveBeenCalledWith("light");
    });

    it("theme selection updates dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        const options = screen.getAllByRole("menuitemradio");
        const nordOption = options.find((el) => el.getAttribute("data-type") === "theme" && el.textContent?.includes("Nord"));
        expect(nordOption).toBeTruthy();
        fireEvent.click(nordOption!);
        expect(mockState.setThemeFamily).toHaveBeenCalledWith("nord");
    });

    it("ArrowDown navigates options in dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        const options = screen.getAllByRole("menuitemradio");
        // Initially focused on "Dark" mode (index 1) because that's the current mode
        expect(options[1]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: "ArrowDown" });
        // Now focused on "System" mode (index 2)
        expect(options[2]).toHaveAttribute("tabIndex", "0");
        expect(options[1]).toHaveAttribute("tabIndex", "-1");
    });

    it("ArrowUp navigates options in dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        const options = screen.getAllByRole("menuitemradio");
        // Initially focused on "Dark" mode (index 1)
        expect(options[1]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: "ArrowUp" });
        // Now focused on "Light" mode (index 0)
        expect(options[0]).toHaveAttribute("tabIndex", "0");
        expect(options[1]).toHaveAttribute("tabIndex", "-1");
    });

    it("Home key jumps to first option", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        const options = screen.getAllByRole("menuitemradio");
        // Initially focused on "Dark" mode (index 1)
        expect(options[1]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: "Home" });
        expect(options[0]).toHaveAttribute("tabIndex", "0");
        expect(options[1]).toHaveAttribute("tabIndex", "-1");
    });

    it("End key jumps to last option", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        const options = screen.getAllByRole("menuitemradio");
        // Initially focused on "Dark" mode (index 1)
        expect(options[1]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: "End" });
        expect(options[options.length - 1]).toHaveAttribute("tabIndex", "0");
        expect(options[1]).toHaveAttribute("tabIndex", "-1");
    });

    it("Enter selects option in dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        const options = screen.getAllByRole("menuitemradio");

        // Navigate to first theme (index 3, after 3 mode buttons)
        fireEvent.keyDown(window, { key: "ArrowDown" });
        fireEvent.keyDown(window, { key: "ArrowDown" });
        expect(options[3]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: "Enter" });
        expect(mockState.setThemeFamily).toHaveBeenCalledWith("default");
    });

    it("Space selects option in dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        const options = screen.getAllByRole("menuitemradio");

        // Navigate to first theme (index 3, after 3 mode buttons)
        fireEvent.keyDown(window, { key: "ArrowDown" });
        fireEvent.keyDown(window, { key: "ArrowDown" });
        expect(options[3]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: " " });
        expect(mockState.setThemeFamily).toHaveBeenCalledWith("default");
    });

    it("Tab cycles forward through options in dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        const options = screen.getAllByRole("menuitemradio");
        // Initially focused on "Dark" mode (index 1)
        expect(options[1]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: "Tab" });
        expect(options[2]).toHaveAttribute("tabIndex", "0");
        expect(options[1]).toHaveAttribute("tabIndex", "-1");
    });

    it("Shift+Tab cycles backward through options in dropdown", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        const options = screen.getAllByRole("menuitemradio");
        // Initially focused on "Dark" mode (index 1)
        expect(options[1]).toHaveAttribute("tabIndex", "0");

        fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
        // Now focused on "Light" mode (index 0)
        expect(options[0]).toHaveAttribute("tabIndex", "0");
        expect(options[1]).toHaveAttribute("tabIndex", "-1");
    });

    it("dropdown closes when clicking outside", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        expect(screen.getByText("Palette")).toBeInTheDocument();

        const backdrop = document.querySelector('[data-overlay="true"]');
        expect(backdrop).toBeInTheDocument();
        fireEvent.click(backdrop!);
        expect(screen.queryByText("Palette")).not.toBeInTheDocument();
    });

    it("aria-checked updates when selection changes", () => {
        render(
            <SettingsProvider>
                <SettingsButton />
            </SettingsProvider>,
        );
        fireEvent.click(screen.getByTitle("Color palette"));
        const options = screen.getAllByRole("menuitemradio");
        const defaultTheme = options.find((el) => el.getAttribute("data-type") === "theme" && el.textContent?.includes("Default"));
        const nordTheme = options.find((el) => el.getAttribute("data-type") === "theme" && el.textContent?.includes("Nord"));

        expect(defaultTheme).toBeTruthy();
        expect(nordTheme).toBeTruthy();
        expect(defaultTheme).toHaveAttribute("aria-checked", "true");
        expect(nordTheme).toHaveAttribute("aria-checked", "false");

        fireEvent.click(nordTheme!);
        expect(mockState.setThemeFamily).toHaveBeenCalledWith("nord");
    });
});

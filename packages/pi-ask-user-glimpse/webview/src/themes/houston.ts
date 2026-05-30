/**
 * Houston theme definition.
 *
 * https://github.com/withastro/houston-vscode
 * Astro's official space-inspired theme.
 */

import type { ThemeDefinition } from "./types";

const darkPalette = {
    bg: { name: "bg", hex: "#17181c", description: "Background" },
    bgDark: { name: "bg-dark", hex: "#131418", description: "Darker background" },
    fg: { name: "fg", hex: "#f4f4f5", description: "Foreground" },
    fgDark: { name: "fg-dark", hex: "#a1a1aa", description: "Muted foreground" },
    blue: { name: "blue", hex: "#4f46e5", description: "Blue" },
    purple: { name: "purple", hex: "#8b5cf6", description: "Purple" },
    red: { name: "red", hex: "#f43f5e", description: "Red" },
    orange: { name: "orange", hex: "#fb923c", description: "Orange" },
    yellow: { name: "yellow", hex: "#facc15", description: "Yellow" },
    green: { name: "green", hex: "#34d399", description: "Green" },
    cyan: { name: "cyan", hex: "#22d3ee", description: "Cyan" },
    border: { name: "border", hex: "#27272a", description: "Border" },
    surface: { name: "surface", hex: "#1f1f23", description: "Surface" },
    surfaceHighlight: { name: "surface-highlight", hex: "#27272a", description: "Surface highlight" },
} as const;

const lightPalette = {
    bg: { name: "bg", hex: "#fafafa", description: "Background" },
    bgDark: { name: "bg-dark", hex: "#f4f4f5", description: "Darker background" },
    fg: { name: "fg", hex: "#18181b", description: "Foreground" },
    fgDark: { name: "fg-dark", hex: "#71717a", description: "Muted foreground" },
    blue: { name: "blue", hex: "#4338ca", description: "Blue" },
    purple: { name: "purple", hex: "#7c3aed", description: "Purple" },
    red: { name: "red", hex: "#e11d48", description: "Red" },
    orange: { name: "orange", hex: "#ea580c", description: "Orange" },
    yellow: { name: "yellow", hex: "#ca8a04", description: "Yellow" },
    green: { name: "green", hex: "#059669", description: "Green" },
    cyan: { name: "cyan", hex: "#0891b2", description: "Cyan" },
    border: { name: "border", hex: "#e4e4e7", description: "Border" },
    surface: { name: "surface", hex: "#f4f4f5", description: "Surface" },
    surfaceHighlight: { name: "surface-highlight", hex: "#e4e4e7", description: "Surface highlight" },
} as const;

export const houston: ThemeDefinition = {
    id: "houston",
    displayName: "Houston",
    description: "Astro's space-inspired theme",
    defaultVariant: "houston",
    variants: [
        {
            id: "houston",
            name: "Houston",
            isDark: true,
            palette: darkPalette,
            tokens: {
                background: darkPalette.bg.hex,
                foreground: darkPalette.fg.hex,
                card: darkPalette.bgDark.hex,
                "card-foreground": darkPalette.fg.hex,
                popover: darkPalette.bgDark.hex,
                "popover-foreground": darkPalette.fg.hex,
                primary: darkPalette.blue.hex,
                "primary-foreground": darkPalette.bg.hex,
                secondary: darkPalette.surface.hex,
                "secondary-foreground": darkPalette.fg.hex,
                muted: darkPalette.surface.hex,
                "muted-foreground": darkPalette.fgDark.hex,
                accent: darkPalette.purple.hex,
                "accent-foreground": darkPalette.bg.hex,
                destructive: darkPalette.red.hex,
                "destructive-foreground": darkPalette.fg.hex,
                border: darkPalette.border.hex,
                input: darkPalette.border.hex,
                ring: darkPalette.blue.hex,
                radius: "0.5rem",
            },
        },
        {
            id: "houston-light",
            name: "Houston Light",
            isDark: false,
            palette: lightPalette,
            tokens: {
                background: lightPalette.bg.hex,
                foreground: lightPalette.fg.hex,
                card: lightPalette.bgDark.hex,
                "card-foreground": lightPalette.fg.hex,
                popover: lightPalette.bgDark.hex,
                "popover-foreground": lightPalette.fg.hex,
                primary: lightPalette.blue.hex,
                "primary-foreground": lightPalette.bg.hex,
                secondary: lightPalette.surface.hex,
                "secondary-foreground": lightPalette.fg.hex,
                muted: lightPalette.surface.hex,
                "muted-foreground": lightPalette.fgDark.hex,
                accent: lightPalette.purple.hex,
                "accent-foreground": lightPalette.bg.hex,
                destructive: lightPalette.red.hex,
                "destructive-foreground": lightPalette.fg.hex,
                border: lightPalette.border.hex,
                input: lightPalette.border.hex,
                ring: lightPalette.blue.hex,
                radius: "0.5rem",
            },
        },
    ],
};

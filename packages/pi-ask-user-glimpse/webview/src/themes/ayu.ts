/**
 * Ayu theme definition.
 *
 * https://github.com/ayu-theme/ayu-colors
 * Modern, minimalistic theme with soft, well-balanced colors.
 */

import type { ThemeDefinition } from "./types";

const darkPalette = {
    bg: { name: "bg", hex: "#0f1419", description: "Background" },
    bgDark: { name: "bg-dark", hex: "#0b0f14", description: "Darker background" },
    fg: { name: "fg", hex: "#bfbdb6", description: "Foreground" },
    fgDark: { name: "fg-dark", hex: "#8a8075", description: "Muted foreground" },
    blue: { name: "blue", hex: "#39bae6", description: "Blue" },
    purple: { name: "purple", hex: "#ca9ee6", description: "Purple" },
    red: { name: "red", hex: "#f26d78", description: "Red" },
    orange: { name: "orange", hex: "#ffa759", description: "Orange" },
    yellow: { name: "yellow", hex: "#ffcc66", description: "Yellow" },
    green: { name: "green", hex: "#7ee787", description: "Green" },
    cyan: { name: "cyan", hex: "#73b8ff", description: "Cyan" },
    border: { name: "border", hex: "#1e2530", description: "Border" },
    surface: { name: "surface", hex: "#131721", description: "Surface" },
    surfaceHighlight: { name: "surface-highlight", hex: "#1e2530", description: "Surface highlight" },
} as const;

const lightPalette = {
    bg: { name: "bg", hex: "#fafafa", description: "Background" },
    bgDark: { name: "bg-dark", hex: "#f3f3f3", description: "Darker background" },
    fg: { name: "fg", hex: "#5c6773", description: "Foreground" },
    fgDark: { name: "fg-dark", hex: "#8a9199", description: "Muted foreground" },
    blue: { name: "blue", hex: "#55b4d4", description: "Blue" },
    purple: { name: "purple", hex: "#a37acc", description: "Purple" },
    red: { name: "red", hex: "#f07178", description: "Red" },
    orange: { name: "orange", hex: "#fa8d3e", description: "Orange" },
    yellow: { name: "yellow", hex: "#f2ae49", description: "Yellow" },
    green: { name: "green", hex: "#86b300", description: "Green" },
    cyan: { name: "cyan", hex: "#4cbf99", description: "Cyan" },
    border: { name: "border", hex: "#e6e6e6", description: "Border" },
    surface: { name: "surface", hex: "#f0f0f0", description: "Surface" },
    surfaceHighlight: { name: "surface-highlight", hex: "#e6e6e6", description: "Surface highlight" },
} as const;

export const ayu: ThemeDefinition = {
    id: "ayu",
    displayName: "Ayu",
    description: "Modern, minimalistic theme",
    defaultVariant: "ayu-dark",
    variants: [
        {
            id: "ayu-dark",
            name: "Ayu Dark",
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
            id: "ayu-light",
            name: "Ayu Light",
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

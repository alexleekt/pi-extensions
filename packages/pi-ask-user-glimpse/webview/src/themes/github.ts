/**
 * GitHub Theme definition.
 *
 * https://github.com/primer/github-vscode-theme
 * Official GitHub colors for VS Code.
 */

import type { ThemeDefinition } from "./types";

const darkPalette = {
    bg: { name: "bg", hex: "#24292e", description: "Background" },
    bgDark: { name: "bg-dark", hex: "#1f2428", description: "Darker background" },
    fg: { name: "fg", hex: "#e1e4e8", description: "Foreground" },
    fgDark: { name: "fg-dark", hex: "#959da5", description: "Muted foreground" },
    blue: { name: "blue", hex: "#79b8ff", description: "Blue" },
    purple: { name: "purple", hex: "#b392f0", description: "Purple" },
    red: { name: "red", hex: "#f97583", description: "Red" },
    orange: { name: "orange", hex: "#ffab70", description: "Orange" },
    yellow: { name: "yellow", hex: "#ffea7f", description: "Yellow" },
    green: { name: "green", hex: "#85e89d", description: "Green" },
    cyan: { name: "cyan", hex: "#7ee787", description: "Cyan" },
    border: { name: "border", hex: "#444d56", description: "Border" },
    surface: { name: "surface", hex: "#2f363d", description: "Surface" },
    surfaceHighlight: { name: "surface-highlight", hex: "#444d56", description: "Surface highlight" },
} as const;

const lightPalette = {
    bg: { name: "bg", hex: "#ffffff", description: "Background" },
    bgDark: { name: "bg-dark", hex: "#f6f8fa", description: "Darker background" },
    fg: { name: "fg", hex: "#24292e", description: "Foreground" },
    fgDark: { name: "fg-dark", hex: "#6a737d", description: "Muted foreground" },
    blue: { name: "blue", hex: "#0366d6", description: "Blue" },
    purple: { name: "purple", hex: "#6f42c1", description: "Purple" },
    red: { name: "red", hex: "#d73a49", description: "Red" },
    orange: { name: "orange", hex: "#e36209", description: "Orange" },
    yellow: { name: "yellow", hex: "#ffd33d", description: "Yellow" },
    green: { name: "green", hex: "#28a745", description: "Green" },
    cyan: { name: "cyan", hex: "#0598bc", description: "Cyan" },
    border: { name: "border", hex: "#e1e4e8", description: "Border" },
    surface: { name: "surface", hex: "#f6f8fa", description: "Surface" },
    surfaceHighlight: { name: "surface-highlight", hex: "#e1e4e8", description: "Surface highlight" },
} as const;

export const github: ThemeDefinition = {
    id: "github",
    displayName: "GitHub",
    description: "Official GitHub colors",
    defaultVariant: "github-dark",
    variants: [
        {
            id: "github-dark",
            name: "GitHub Dark",
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
            id: "github-light",
            name: "GitHub Light",
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

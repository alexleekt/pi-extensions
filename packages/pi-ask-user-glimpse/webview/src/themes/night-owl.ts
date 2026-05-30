/**
 * Night Owl theme definition.
 *
 * https://github.com/sdras/night-owl-vscode-theme
 * Sarah Drasner's theme for the night owls out there.
 */

import type { ThemeDefinition } from "./types";

const darkPalette = {
    bg: { name: "bg", hex: "#011627", description: "Background" },
    bgDark: { name: "bg-dark", hex: "#010e1a", description: "Darker background" },
    fg: { name: "fg", hex: "#d6deeb", description: "Foreground" },
    fgDark: { name: "fg-dark", hex: "#7f9bb5", description: "Muted foreground" },
    blue: { name: "blue", hex: "#82aaff", description: "Blue" },
    purple: { name: "purple", hex: "#c792ea", description: "Purple" },
    red: { name: "red", hex: "#ef5350", description: "Red" },
    orange: { name: "orange", hex: "#f78c6c", description: "Orange" },
    yellow: { name: "yellow", hex: "#ffcb8b", description: "Yellow" },
    green: { name: "green", hex: "#c3e88d", description: "Green" },
    cyan: { name: "cyan", hex: "#89ddff", description: "Cyan" },
    border: { name: "border", hex: "#1d3b53", description: "Border" },
    surface: { name: "surface", hex: "#0b2942", description: "Surface" },
    surfaceHighlight: { name: "surface-highlight", hex: "#1d3b53", description: "Surface highlight" },
} as const;

const lightPalette = {
    bg: { name: "bg", hex: "#f8f9fa", description: "Background" },
    bgDark: { name: "bg-dark", hex: "#e9ecef", description: "Darker background" },
    fg: { name: "fg", hex: "#1a2b3c", description: "Foreground" },
    fgDark: { name: "fg-dark", hex: "#5a6b7c", description: "Muted foreground" },
    blue: { name: "blue", hex: "#3d5a80", description: "Blue" },
    purple: { name: "purple", hex: "#7b4f9c", description: "Purple" },
    red: { name: "red", hex: "#c0392b", description: "Red" },
    orange: { name: "orange", hex: "#d35400", description: "Orange" },
    yellow: { name: "yellow", hex: "#d4a017", description: "Yellow" },
    green: { name: "green", hex: "#27ae60", description: "Green" },
    cyan: { name: "cyan", hex: "#2980b9", description: "Cyan" },
    border: { name: "border", hex: "#dee2e6", description: "Border" },
    surface: { name: "surface", hex: "#e9ecef", description: "Surface" },
    surfaceHighlight: { name: "surface-highlight", hex: "#dee2e6", description: "Surface highlight" },
} as const;

export const nightOwl: ThemeDefinition = {
    id: "night-owl",
    displayName: "Night Owl",
    description: "Theme for the night owls",
    defaultVariant: "night-owl",
    variants: [
        {
            id: "night-owl",
            name: "Night Owl",
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
            id: "night-owl-light",
            name: "Night Owl Light",
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

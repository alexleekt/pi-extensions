/**
 * One Dark theme definition.
 *
 * Atom's iconic dark theme.
 */

import type { ThemeDefinition } from "./types";

const darkPalette = {
    background: { name: "background", hex: "#282c34", description: "Background" },
    foreground: { name: "foreground", hex: "#abb2bf", description: "Foreground" },
    cursor: { name: "cursor", hex: "#528bff", description: "Cursor" },
    selection: { name: "selection", hex: "#3e4451", description: "Selection" },
    comment: { name: "comment", hex: "#5c6370", description: "Comment" },
    red: { name: "red", hex: "#e06c75", description: "Red" },
    green: { name: "green", hex: "#98c379", description: "Green" },
    yellow: { name: "yellow", hex: "#e5c07b", description: "Yellow" },
    blue: { name: "blue", hex: "#61afef", description: "Blue" },
    purple: { name: "purple", hex: "#c678dd", description: "Purple" },
    cyan: { name: "cyan", hex: "#56b6c2", description: "Cyan" },
} as const;

const lightPalette = {
    background: { name: "background", hex: "#fafafa", description: "Background" },
    foreground: { name: "foreground", hex: "#383a42", description: "Foreground" },
    cursor: { name: "cursor", hex: "#4078f2", description: "Cursor" },
    selection: { name: "selection", hex: "#e5e5e6", description: "Selection" },
    comment: { name: "comment", hex: "#a0a1a7", description: "Comment" },
    red: { name: "red", hex: "#ca1243", description: "Red" },
    green: { name: "green", hex: "#50a14f", description: "Green" },
    yellow: { name: "yellow", hex: "#c18401", description: "Yellow" },
    blue: { name: "blue", hex: "#4078f2", description: "Blue" },
    purple: { name: "purple", hex: "#a626a4", description: "Purple" },
    cyan: { name: "cyan", hex: "#0184bc", description: "Cyan" },
} as const;

export const oneDark: ThemeDefinition = {
    id: "one-dark",
    displayName: "One Dark",
    description: "Atom's iconic dark theme",
    defaultVariant: "one-dark",
    variants: [
        {
            id: "one-dark",
            name: "One Dark",
            isDark: true,
            palette: darkPalette,
            tokens: {
                background: darkPalette.background.hex,
                foreground: darkPalette.foreground.hex,
                card: darkPalette.selection.hex,
                "card-foreground": darkPalette.foreground.hex,
                popover: darkPalette.selection.hex,
                "popover-foreground": darkPalette.foreground.hex,
                primary: darkPalette.blue.hex,
                "primary-foreground": darkPalette.background.hex,
                secondary: darkPalette.comment.hex,
                "secondary-foreground": darkPalette.foreground.hex,
                muted: darkPalette.selection.hex,
                "muted-foreground": darkPalette.comment.hex,
                accent: darkPalette.purple.hex,
                "accent-foreground": darkPalette.background.hex,
                destructive: darkPalette.red.hex,
                "destructive-foreground": darkPalette.foreground.hex,
                border: darkPalette.comment.hex,
                input: darkPalette.comment.hex,
                ring: darkPalette.blue.hex,
                radius: "0.5rem",
            },
        },
        {
            id: "one-light",
            name: "One Light",
            isDark: false,
            palette: lightPalette,
            tokens: {
                background: lightPalette.background.hex,
                foreground: lightPalette.foreground.hex,
                card: lightPalette.selection.hex,
                "card-foreground": lightPalette.foreground.hex,
                popover: lightPalette.selection.hex,
                "popover-foreground": lightPalette.foreground.hex,
                primary: lightPalette.blue.hex,
                "primary-foreground": lightPalette.background.hex,
                secondary: lightPalette.comment.hex,
                "secondary-foreground": lightPalette.foreground.hex,
                muted: lightPalette.selection.hex,
                "muted-foreground": lightPalette.comment.hex,
                accent: lightPalette.purple.hex,
                "accent-foreground": lightPalette.background.hex,
                destructive: lightPalette.red.hex,
                "destructive-foreground": lightPalette.foreground.hex,
                border: lightPalette.comment.hex,
                input: lightPalette.comment.hex,
                ring: lightPalette.blue.hex,
                radius: "0.5rem",
            },
        },
    ],
};

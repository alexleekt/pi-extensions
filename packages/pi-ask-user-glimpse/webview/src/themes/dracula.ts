/**
 * Dracula theme definition.
 *
 * https://draculatheme.com
 */

import type { ThemeDefinition } from "./types";

const darkPalette = {
    background: { name: "background", hex: "#282a36", description: "Background" },
    foreground: { name: "foreground", hex: "#f8f8f2", description: "Foreground" },
    selection: { name: "selection", hex: "#44475a", description: "Selection" },
    comment: { name: "comment", hex: "#6272a4", description: "Comment" },
    cyan: { name: "cyan", hex: "#8be9fd", description: "Cyan" },
    green: { name: "green", hex: "#50fa7b", description: "Green" },
    orange: { name: "orange", hex: "#ffb86c", description: "Orange" },
    pink: { name: "pink", hex: "#ff79c6", description: "Pink" },
    purple: { name: "purple", hex: "#bd93f9", description: "Purple" },
    red: { name: "red", hex: "#ff5555", description: "Red" },
    yellow: { name: "yellow", hex: "#f1fa8c", description: "Yellow" },
} as const;

const lightPalette = {
    background: { name: "background", hex: "#f8f8f2", description: "Background" },
    foreground: { name: "foreground", hex: "#282a36", description: "Foreground" },
    selection: { name: "selection", hex: "#e2e2e2", description: "Selection" },
    comment: { name: "comment", hex: "#8a8ebc", description: "Comment" },
    cyan: { name: "cyan", hex: "#0580b8", description: "Cyan" },
    green: { name: "green", hex: "#1a6b2e", description: "Green" },
    orange: { name: "orange", hex: "#a76a3e", description: "Orange" },
    pink: { name: "pink", hex: "#c84c9e", description: "Pink" },
    purple: { name: "purple", hex: "#6b4c8e", description: "Purple" },
    red: { name: "red", hex: "#c22b2b", description: "Red" },
    yellow: { name: "yellow", hex: "#8a6e2f", description: "Yellow" },
} as const;

export const dracula: ThemeDefinition = {
    id: "dracula",
    displayName: "Dracula",
    description: "A dark theme for vampires",
    defaultVariant: "dracula",
    variants: [
        {
            id: "dracula",
            name: "Dracula",
            isDark: true,
            palette: darkPalette,
            tokens: {
                background: darkPalette.background.hex,
                foreground: darkPalette.foreground.hex,
                card: darkPalette.selection.hex,
                "card-foreground": darkPalette.foreground.hex,
                popover: darkPalette.selection.hex,
                "popover-foreground": darkPalette.foreground.hex,
                primary: darkPalette.purple.hex,
                "primary-foreground": darkPalette.background.hex,
                secondary: darkPalette.comment.hex,
                "secondary-foreground": darkPalette.foreground.hex,
                muted: darkPalette.selection.hex,
                "muted-foreground": darkPalette.comment.hex,
                accent: darkPalette.pink.hex,
                "accent-foreground": darkPalette.background.hex,
                destructive: darkPalette.red.hex,
                "destructive-foreground": darkPalette.foreground.hex,
                border: darkPalette.comment.hex,
                input: darkPalette.comment.hex,
                ring: darkPalette.purple.hex,
                radius: "0.5rem",
            },
        },
        {
            id: "dracula-light",
            name: "Dracula Light",
            isDark: false,
            palette: lightPalette,
            tokens: {
                background: lightPalette.background.hex,
                foreground: lightPalette.foreground.hex,
                card: lightPalette.selection.hex,
                "card-foreground": lightPalette.foreground.hex,
                popover: lightPalette.selection.hex,
                "popover-foreground": lightPalette.foreground.hex,
                primary: lightPalette.purple.hex,
                "primary-foreground": lightPalette.background.hex,
                secondary: lightPalette.comment.hex,
                "secondary-foreground": lightPalette.foreground.hex,
                muted: lightPalette.selection.hex,
                "muted-foreground": lightPalette.comment.hex,
                accent: lightPalette.pink.hex,
                "accent-foreground": lightPalette.background.hex,
                destructive: lightPalette.red.hex,
                "destructive-foreground": lightPalette.foreground.hex,
                border: lightPalette.comment.hex,
                input: lightPalette.comment.hex,
                ring: lightPalette.purple.hex,
                radius: "0.5rem",
            },
        },
    ],
};

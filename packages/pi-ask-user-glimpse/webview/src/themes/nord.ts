/**
 * Nord theme definition.
 *
 * https://www.nordtheme.com
 * An arctic, north-bluish color palette.
 *
 * Colors:
 * Polar Night:  nord0 (#2E3440), nord1 (#3B4252), nord2 (#434C5E), nord3 (#4C566A)
 * Snow Storm:   nord4 (#D8DEE9), nord5 (#E5E9F0), nord6 (#ECEFF4)
 * Frost:        nord7 (#8FBCBB), nord8 (#88C0D0), nord9 (#81A1C1), nord10 (#5E81AC)
 * Aurora:       nord11 (#BF616A), nord12 (#D08770), nord13 (#EBCB8B), nord14 (#A3BE8C), nord15 (#B48EAD)
 */

import type { ThemeDefinition } from "./types";

const palette = {
    nord0: { name: "nord0", hex: "#2E3440", description: "Polar Night darkest" },
    nord1: { name: "nord1", hex: "#3B4252", description: "Polar Night dark" },
    nord2: { name: "nord2", hex: "#434C5E", description: "Polar Night" },
    nord3: { name: "nord3", hex: "#4C566A", description: "Polar Night light" },
    nord4: { name: "nord4", hex: "#D8DEE9", description: "Snow Storm dark" },
    nord5: { name: "nord5", hex: "#E5E9F0", description: "Snow Storm" },
    nord6: { name: "nord6", hex: "#ECEFF4", description: "Snow Storm light" },
    nord7: { name: "nord7", hex: "#8FBCBB", description: "Frost light" },
    nord8: { name: "nord8", hex: "#88C0D0", description: "Frost" },
    nord9: { name: "nord9", hex: "#81A1C1", description: "Frost muted" },
    nord10: { name: "nord10", hex: "#5E81AC", description: "Frost dark" },
    nord11: { name: "nord11", hex: "#BF616A", description: "Aurora red" },
    nord12: { name: "nord12", hex: "#D08770", description: "Aurora orange" },
    nord13: { name: "nord13", hex: "#EBCB8B", description: "Aurora yellow" },
    nord14: { name: "nord14", hex: "#A3BE8C", description: "Aurora green" },
    nord15: { name: "nord15", hex: "#B48EAD", description: "Aurora purple" },
} as const;

export const nord: ThemeDefinition = {
    id: "nord",
    displayName: "Nord",
    description: "An arctic, north-bluish color palette",
    defaultVariant: "nord-dark",
    variants: [
        {
            id: "nord-dark",
            name: "Nord",
            isDark: true,
            palette,
            tokens: {
                background: palette.nord0.hex,
                foreground: palette.nord6.hex,
                card: palette.nord1.hex,
                "card-foreground": palette.nord6.hex,
                popover: palette.nord1.hex,
                "popover-foreground": palette.nord6.hex,
                primary: palette.nord8.hex,
                "primary-foreground": palette.nord0.hex,
                secondary: palette.nord2.hex,
                "secondary-foreground": palette.nord6.hex,
                muted: palette.nord1.hex,
                "muted-foreground": palette.nord3.hex,
                accent: palette.nord10.hex,
                "accent-foreground": palette.nord6.hex,
                destructive: palette.nord11.hex,
                "destructive-foreground": palette.nord6.hex,
                border: palette.nord3.hex,
                input: palette.nord3.hex,
                ring: palette.nord8.hex,
                radius: "0.5rem",
            },
        },
        {
            id: "nord-light",
            name: "Nord Light",
            isDark: false,
            palette,
            tokens: {
                background: palette.nord6.hex,
                foreground: palette.nord0.hex,
                card: palette.nord5.hex,
                "card-foreground": palette.nord0.hex,
                popover: palette.nord5.hex,
                "popover-foreground": palette.nord0.hex,
                primary: palette.nord10.hex,
                "primary-foreground": palette.nord6.hex,
                secondary: palette.nord4.hex,
                "secondary-foreground": palette.nord0.hex,
                muted: palette.nord5.hex,
                "muted-foreground": palette.nord2.hex,
                accent: palette.nord8.hex,
                "accent-foreground": palette.nord0.hex,
                destructive: palette.nord11.hex,
                "destructive-foreground": palette.nord6.hex,
                border: palette.nord4.hex,
                input: palette.nord4.hex,
                ring: palette.nord10.hex,
                radius: "0.5rem",
            },
        },
    ],
};

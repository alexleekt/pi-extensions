/**
 * Catppuccin theme definition.
 *
 * Uses the official @catppuccin/palette npm package.
 * Supports all 4 variants: Latte, Frappé, Macchiato, Mocha.
 */

import type { ThemeDefinition } from "./types";

// The palette package is imported dynamically at runtime to avoid
// bundling the entire 800KB palette file if we only need a few colors.
// We import just the specific variant colors we need.
let _paletteModule: any = null;

async function getPalette() {
    if (!_paletteModule) {
        _paletteModule = await import("@catppuccin/palette");
    }
    return _paletteModule;
}

/**
 * Build a Catppuccin variant from the official palette.
 * This is called once at module init time.
 */
export async function buildCatppuccinTheme(): Promise<ThemeDefinition> {
    const palette = await getPalette();
    const variants = ["latte", "frappe", "macchiato", "mocha"] as const;

    const themeVariants = variants.map((variantKey) => {
        const v = palette.default[variantKey];
        const colors = v.colors;

        return {
            id: `catppuccin-${variantKey}`,
            name: v.name,
            isDark: v.dark,
            palette: Object.fromEntries(
                Object.entries(colors).map(([key, color]: [string, any]) => [
                    key,
                    { name: color.name, hex: color.hex },
                ]),
            ),
            tokens: {
                background: colors.base.hex,
                foreground: colors.text.hex,
                card: colors.surface0.hex,
                "card-foreground": colors.text.hex,
                popover: colors.surface0.hex,
                "popover-foreground": colors.text.hex,
                primary: colors.mauve.hex,
                "primary-foreground": colors.base.hex,
                secondary: colors.surface1.hex,
                "secondary-foreground": colors.text.hex,
                muted: colors.surface0.hex,
                "muted-foreground": colors.subtext0.hex,
                accent: colors.blue.hex,
                "accent-foreground": colors.base.hex,
                destructive: colors.red.hex,
                "destructive-foreground": colors.base.hex,
                border: colors.surface1.hex,
                input: colors.surface1.hex,
                ring: colors.mauve.hex,
                radius: "0.5rem",
            },
        };
    });

    return {
        id: "catppuccin",
        displayName: "Catppuccin",
        description: "Soothing pastel theme with 4 variants",
        defaultVariant: "catppuccin-mocha",
        variants: themeVariants,
    };
}

// Synchronous fallback: if we can't load the palette, use hardcoded values.
// This ensures the module always exports a valid ThemeDefinition.
export const catppuccin: ThemeDefinition = {
    id: "catppuccin",
    displayName: "Catppuccin",
    description: "Soothing pastel theme with 4 variants",
    defaultVariant: "catppuccin-mocha",
    variants: [
        {
            id: "catppuccin-latte",
            name: "Latte",
            isDark: false,
            palette: {},
            tokens: {
                background: "#eff1f5",
                foreground: "#4c4f69",
                card: "#ccd0da",
                "card-foreground": "#4c4f69",
                popover: "#ccd0da",
                "popover-foreground": "#4c4f69",
                primary: "#8839ef",
                "primary-foreground": "#eff1f5",
                secondary: "#bcc0cc",
                "secondary-foreground": "#4c4f69",
                muted: "#ccd0da",
                "muted-foreground": "#8c8fa1",
                accent: "#1e66f5",
                "accent-foreground": "#eff1f5",
                destructive: "#d20f39",
                "destructive-foreground": "#eff1f5",
                border: "#bcc0cc",
                input: "#bcc0cc",
                ring: "#8839ef",
                radius: "0.5rem",
            },
        },
        {
            id: "catppuccin-frappe",
            name: "Frappé",
            isDark: true,
            palette: {},
            tokens: {
                background: "#303446",
                foreground: "#c6d0f5",
                card: "#414559",
                "card-foreground": "#c6d0f5",
                popover: "#414559",
                "popover-foreground": "#c6d0f5",
                primary: "#ca9ee6",
                "primary-foreground": "#303446",
                secondary: "#51576d",
                "secondary-foreground": "#c6d0f5",
                muted: "#414559",
                "muted-foreground": "#737994",
                accent: "#8caaee",
                "accent-foreground": "#303446",
                destructive: "#e78284",
                "destructive-foreground": "#303446",
                border: "#51576d",
                input: "#51576d",
                ring: "#ca9ee6",
                radius: "0.5rem",
            },
        },
        {
            id: "catppuccin-macchiato",
            name: "Macchiato",
            isDark: true,
            palette: {},
            tokens: {
                background: "#24273a",
                foreground: "#cad3f5",
                card: "#363a4f",
                "card-foreground": "#cad3f5",
                popover: "#363a4f",
                "popover-foreground": "#cad3f5",
                primary: "#c6a0f6",
                "primary-foreground": "#24273a",
                secondary: "#494d64",
                "secondary-foreground": "#cad3f5",
                muted: "#363a4f",
                "muted-foreground": "#6e738d",
                accent: "#8aadf4",
                "accent-foreground": "#24273a",
                destructive: "#ed8796",
                "destructive-foreground": "#24273a",
                border: "#494d64",
                input: "#494d64",
                ring: "#c6a0f6",
                radius: "0.5rem",
            },
        },
        {
            id: "catppuccin-mocha",
            name: "Mocha",
            isDark: true,
            palette: {},
            tokens: {
                background: "#1e1e2e",
                foreground: "#cdd6f4",
                card: "#313244",
                "card-foreground": "#cdd6f4",
                popover: "#313244",
                "popover-foreground": "#cdd6f4",
                primary: "#cba6f7",
                "primary-foreground": "#1e1e2e",
                secondary: "#45475a",
                "secondary-foreground": "#cdd6f4",
                muted: "#313244",
                "muted-foreground": "#6c7086",
                accent: "#89b4fa",
                "accent-foreground": "#1e1e2e",
                destructive: "#f38ba8",
                "destructive-foreground": "#1e1e2e",
                border: "#45475a",
                input: "#45475a",
                ring: "#cba6f7",
                radius: "0.5rem",
            },
        },
    ],
};

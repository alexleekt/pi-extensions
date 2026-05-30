/**
 * Theme system types for pi-ask-user-glimpse.
 *
 * Each theme brand (e.g., "catppuccin", "nord") has one or more variants.
 * A variant maps semantic tokens (background, primary, etc.) to specific
 * colors from the theme's palette.
 */

/** A single color in the official theme palette */
export interface PaletteColor {
    name: string;
    hex: string;
    description?: string;
}

/** Semantic token mapping for a theme variant */
export interface SemanticTokens {
    background: string;
    foreground: string;
    card: string;
    "card-foreground": string;
    popover: string;
    "popover-foreground": string;
    primary: string;
    "primary-foreground": string;
    secondary: string;
    "secondary-foreground": string;
    muted: string;
    "muted-foreground": string;
    accent: string;
    "accent-foreground": string;
    destructive: string;
    "destructive-foreground": string;
    border: string;
    input: string;
    ring: string;
    radius: string;
}

/** A theme variant (e.g., "dark" or "light" variant of a brand) */
export interface ThemeVariant {
    id: ThemeId;
    name: string;
    isDark: boolean;
    palette: Record<string, PaletteColor>;
    tokens: SemanticTokens;
}

/** A theme brand (e.g., "nord", "catppuccin") */
export interface ThemeDefinition {
    id: ThemeFamilyId;
    displayName: string;
    description?: string;
    variants: ThemeVariant[];
    defaultVariant: ThemeId;
}

/** Theme family identifier (e.g., "nord", "catppuccin") */
export type ThemeFamilyId =
    | "default"
    | "catppuccin"
    | "nord"
    | "tokyo-night"
    | "dracula"
    | "one-dark"
    | "ayu"
    | "github"
    | "night-owl"
    | "houston";

/** Concrete theme variant identifier (e.g., "nord-dark", "catppuccin-mocha") */
export type ThemeId =
    | "light"
    | "dark"
    | "catppuccin-latte"
    | "catppuccin-frappe"
    | "catppuccin-macchiato"
    | "catppuccin-mocha"
    | "nord-dark"
    | "nord-light"
    | "tokyo-night"
    | "tokyo-night-storm"
    | "tokyo-night-light"
    | "dracula"
    | "dracula-light"
    | "one-dark"
    | "one-light"
    | "ayu-dark"
    | "ayu-light"
    | "github-dark"
    | "github-light"
    | "night-owl"
    | "night-owl-light"
    | "houston"
    | "houston-light";

/** Theme mode: light/dark/system */
export type ThemeMode = "light" | "dark" | "system";

export interface ThemeRegistry {
    themes: ThemeDefinition[];
    getVariant(id: ThemeId): ThemeVariant | undefined;
    getDefinition(id: ThemeId): ThemeDefinition | undefined;
    getAllVariantIds(): ThemeId[];
    getDefaultThemeId(): ThemeId;
}

export interface ThemeConfig {
    name: ThemeId;
    mode: ThemeMode;
}

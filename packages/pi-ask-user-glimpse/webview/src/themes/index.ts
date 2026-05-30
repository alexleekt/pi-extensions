/**
 * Theme registry for pi-ask-user-glimpse.
 *
 * Central registry for all theme definitions. Provides O(1) lookup helpers
 * and type-safe theme IDs.
 */

import type { ThemeDefinition, ThemeVariant, ThemeId, ThemeConfig, ThemeFamilyId } from "./types";
import { defaultTheme } from "./default";
import { catppuccin } from "./catppuccin";
import { nord } from "./nord";
import { tokyoNight } from "./tokyo-night";
import { dracula } from "./dracula";
import { oneDark } from "./one-dark";
import { ayu } from "./ayu";
import { github } from "./github";
import { nightOwl } from "./night-owl";
import { houston } from "./houston";

export * from "./types";
export { hexToHsl } from "./converter";

const registry: ThemeDefinition[] = [
    defaultTheme,
    catppuccin,
    nord,
    tokyoNight,
    dracula,
    oneDark,
    ayu,
    github,
    nightOwl,
    houston,
];

/* ── O(1) lookup maps ── */

const variantMap = new Map<ThemeId, { variant: ThemeVariant; definition: ThemeDefinition }>();
const definitionMap = new Map<ThemeFamilyId, ThemeDefinition>();

for (const def of registry) {
    definitionMap.set(def.id, def);
    for (const v of def.variants) {
        variantMap.set(v.id, { variant: v, definition: def });
    }
}

export function getThemeVariant(id: ThemeId): ThemeVariant | undefined {
    return variantMap.get(id)?.variant;
}

export function getThemeDefinition(id: ThemeId): ThemeDefinition | undefined {
    return variantMap.get(id)?.definition;
}

export function getThemeFamilyId(variantId: ThemeId): ThemeFamilyId | undefined {
    return variantMap.get(variantId)?.definition.id;
}

export function getThemeFamilyById(id: ThemeFamilyId): ThemeDefinition | undefined {
    return definitionMap.get(id);
}

export function getAllVariantIds(): ThemeId[] {
    return Array.from(variantMap.keys());
}

export function getDefaultThemeId(): ThemeId {
    return defaultTheme.defaultVariant;
}

export function isDarkTheme(id: ThemeId): boolean {
    const variant = getThemeVariant(id);
    return variant?.isDark ?? false;
}

export function getThemeName(id: ThemeId): string {
    const variant = getThemeVariant(id);
    return variant?.name ?? id;
}

export function getThemeDisplayName(id: ThemeId): string {
    const def = getThemeDefinition(id);
    return def?.displayName ?? id;
}

export function getThemeCategory(id: ThemeId): "default" | "community" {
    const def = getThemeDefinition(id);
    return def?.id === "default" ? "default" : "community";
}

/** All registered theme definitions */
export const THEMES = registry;

/** Theme IDs available for selection */
export const AVAILABLE_THEME_IDS: ThemeId[] = getAllVariantIds();

/** Theme categories with their variants */
export const THEME_CATEGORIES = [
    {
        id: "default" as const,
        name: "Default",
        themes: defaultTheme.variants.map((v) => v.id),
    },
    {
        id: "community" as const,
        name: "Community",
        themes: registry
            .filter((t) => t.id !== "default")
            .flatMap((t) => t.variants.map((v) => v.id)),
    },
];

/** Returns true if a theme definition has at least one dark and one light variant. */
export function hasDarkLightPairing(def: ThemeDefinition): boolean {
    const hasDark = def.variants.some((v) => v.isDark);
    const hasLight = def.variants.some((v) => !v.isDark);
    return hasDark && hasLight;
}

/** Returns the theme definitions that have both dark and light variants. */
export function getThemesWithDarkLightPairing(): ThemeDefinition[] {
    return registry.filter(hasDarkLightPairing);
}

/** Get the dark variant of a theme definition, or undefined. */
export function getDarkVariant(def: ThemeDefinition): ThemeVariant | undefined {
    return def.variants.find((v) => v.isDark);
}

/** Get the light variant of a theme definition, or undefined. */
export function getLightVariant(def: ThemeDefinition): ThemeVariant | undefined {
    return def.variants.find((v) => !v.isDark);
}

/** Get the dark/light variant of a theme definition, preferring the one matching the given mode. */
export function getVariantForMode(def: ThemeDefinition, preferDark: boolean): ThemeVariant | undefined {
    return preferDark ? getDarkVariant(def) : getLightVariant(def);
}

/** Get the default variant ID for a given theme definition and mode. */
export function getDefaultVariantIdForMode(def: ThemeDefinition, preferDark: boolean): ThemeId {
    const variant = getVariantForMode(def, preferDark);
    return variant?.id ?? def.defaultVariant;
}

/** Get the opposite variant ID for the same theme (dark → light, light → dark). */
export function getOppositeVariantId(id: ThemeId): ThemeId | undefined {
    const def = getThemeDefinition(id);
    if (!def) return undefined;
    const currentVariant = getThemeVariant(id);
    if (!currentVariant) return undefined;
    const target = currentVariant.isDark ? getLightVariant(def) : getDarkVariant(def);
    return target?.id;
}

/** Resolve a theme config to the actual theme ID and mode */
export function resolveThemeConfig(config: ThemeConfig): {
    themeId: ThemeId;
    resolvedMode: "light" | "dark";
} {
    const { name, mode } = config;
    const variant = getThemeVariant(name);
    if (!variant) {
        return { themeId: getDefaultThemeId(), resolvedMode: "dark" };
    }

    let resolvedMode: "light" | "dark";
    if (mode === "system") {
        if (typeof window !== "undefined") {
            try {
                resolvedMode = window.matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light";
            } catch {
                resolvedMode = "light";
            }
        } else {
            resolvedMode = "dark";
        }
    } else {
        resolvedMode = mode;
    }

    return { themeId: name, resolvedMode };
}

/** Get theme CSS class name for the data-theme attribute */
export function getThemeDataAttribute(id: ThemeId): string {
    return id;
}

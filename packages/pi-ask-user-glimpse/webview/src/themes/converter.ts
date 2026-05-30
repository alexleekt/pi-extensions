/**
 * Color conversion utilities.
 *
 * We store source colors as hex (from official theme specs) and convert
 * to HSL for CSS custom properties, because Tailwind v3 expects
 * space-separated HSL values in `hsl(var(--name) / 0.1)`.
 */

const HEX_6_RE = /^#[0-9a-fA-F]{6}$/;
const HEX_3_RE = /^#[0-9a-fA-F]{3}$/;

/** Normalise shorthand #RGB → #RRGGBB */
function normalizeHex(hex: string): string {
    if (HEX_6_RE.test(hex)) return hex;
    if (HEX_3_RE.test(hex)) {
        return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    throw new Error(`Invalid hex color: ${hex}. Expected #RGB or #RRGGBB.`);
}

export function hexToHsl(hex: string): string {
    const normalized = normalizeHex(hex);
    const r = parseInt(normalized.slice(1, 3), 16) / 255;
    const g = parseInt(normalized.slice(3, 5), 16) / 255;
    const b = parseInt(normalized.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    const hDeg = Math.round(h * 360);
    const sPct = Math.round(s * 1000) / 10;
    const lPct = Math.round(l * 1000) / 10;

    return `${hDeg} ${sPct}% ${lPct}%`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const normalized = normalizeHex(hex);
    return {
        r: parseInt(normalized.slice(1, 3), 16),
        g: parseInt(normalized.slice(3, 5), 16),
        b: parseInt(normalized.slice(5, 7), 16),
    };
}

/** Check if a color is dark (lightness < 50%) */
export function isDarkColor(hex: string): boolean {
    const { r, g, b } = hexToRgb(hex);
    // Relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
}

/**
 * Default theme definition.
 *
 * Clean modern light and dark variants.
 */

import type { ThemeDefinition } from "./types";

export const defaultTheme: ThemeDefinition = {
    id: "default",
    displayName: "Default",
    description: "Clean modern light and dark",
    defaultVariant: "dark",
    variants: [
        {
            id: "light",
            name: "Light",
            isDark: false,
            palette: {},
            tokens: {
                background: "#f8fafc",
                foreground: "#0f172a",
                card: "#ffffff",
                "card-foreground": "#0f172a",
                popover: "#ffffff",
                "popover-foreground": "#0f172a",
                primary: "#2563eb",
                "primary-foreground": "#ffffff",
                secondary: "#e2e8f0",
                "secondary-foreground": "#1e293b",
                muted: "#f1f5f9",
                "muted-foreground": "#64748b",
                accent: "#3b82f6",
                "accent-foreground": "#ffffff",
                destructive: "#ef4444",
                "destructive-foreground": "#ffffff",
                border: "#e2e8f0",
                input: "#e2e8f0",
                ring: "#2563eb",
                radius: "0.5rem",
            },
        },
        {
            id: "dark",
            name: "Dark",
            isDark: true,
            palette: {},
            tokens: {
                background: "#0f172a",
                foreground: "#f8fafc",
                card: "#1e293b",
                "card-foreground": "#f8fafc",
                popover: "#1e293b",
                "popover-foreground": "#f8fafc",
                primary: "#60a5fa",
                "primary-foreground": "#0f172a",
                secondary: "#334155",
                "secondary-foreground": "#f8fafc",
                muted: "#1e293b",
                "muted-foreground": "#94a3b8",
                accent: "#3b82f6",
                "accent-foreground": "#f8fafc",
                destructive: "#f87171",
                "destructive-foreground": "#0f172a",
                border: "#334155",
                input: "#334155",
                ring: "#60a5fa",
                radius: "0.5rem",
            },
        },
    ],
};

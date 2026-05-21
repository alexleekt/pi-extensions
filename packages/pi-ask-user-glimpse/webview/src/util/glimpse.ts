import { getCurrentAnimationLevel, getCurrentTheme } from "./settings";

/**
 * Send data to the Glimpse native host through the global window.glimpse bridge.
 * Automatically appends current theme and animation level metadata.
 */
export function sendToGlimpse(data: unknown): void {
    const record =
        typeof data === "object" && data !== null
            ? (data as Record<string, unknown>)
            : {};
    const enriched = {
        ...record,
        __theme: getCurrentTheme(),
        __animationLevel: getCurrentAnimationLevel(),
    };
    (
        window as unknown as { glimpse: { send: (data: unknown) => void } }
    ).glimpse.send(enriched);
}

/**
 * Signal that the user cancelled the dialog.
 */
export function sendCancelled(): void {
    sendToGlimpse({ __cancelled: true });
}

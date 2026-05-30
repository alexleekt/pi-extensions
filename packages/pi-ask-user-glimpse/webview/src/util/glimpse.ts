import { getCurrentAnimationLevel, getCurrentMode } from "./settings";

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
        __theme: getCurrentMode(),
        __animationLevel: getCurrentAnimationLevel(),
    };
    const bridge = (window as unknown as Record<string, unknown>).glimpse as
        | { send: (data: unknown) => void }
        | undefined;
    if (!bridge) {
        throw new Error("Glimpse bridge not available");
    }
    bridge.send(enriched);
}

/**
 * Safe variant of sendToGlimpse that catches bridge errors and returns
 * whether the send succeeded. Use this in event handlers where a throw
 * would leave the UI in a broken state.
 */
export function sendToGlimpseSafe(data: unknown): boolean {
    try {
        sendToGlimpse(data);
        return true;
    } catch (err) {
        console.error("[pi-ask-user-glimpse] Failed to send to Glimpse:", err);
        return false;
    }
}

/**
 * Signal that the user cancelled the dialog.
 */
export function sendCancelled(): void {
    sendToGlimpse({ __cancelled: true });
}

/**
 * Safe variant of sendCancelled that catches bridge errors and returns
 * whether the cancel was sent. Resets the sent guard so the user can retry.
 */
export function sendCancelledSafe(): boolean {
    return sendToGlimpseSafe({ __cancelled: true });
}

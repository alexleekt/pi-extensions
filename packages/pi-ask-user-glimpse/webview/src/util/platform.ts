/**
 * Detect whether the user is on macOS for platform-specific UI copy.
 */
export function isMac(): boolean {
    return navigator.platform.toLowerCase().includes("mac");
}

export function modKey(): string {
    return isMac() ? "⌘" : "Ctrl";
}

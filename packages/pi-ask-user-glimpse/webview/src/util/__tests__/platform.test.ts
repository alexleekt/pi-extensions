import { describe, expect, it } from "vitest";
import { modKey } from "../platform";

describe("platform utilities", () => {
    describe("modKey", () => {
        it("returns '⌘' on macOS", () => {
            Object.defineProperty(navigator, "platform", {
                value: "MacIntel",
                configurable: true,
            });
            expect(modKey()).toBe("⌘");
        });

        it("returns 'Ctrl' on Windows", () => {
            Object.defineProperty(navigator, "platform", {
                value: "Win32",
                configurable: true,
            });
            expect(modKey()).toBe("Ctrl");
        });

        it("returns 'Ctrl' on Linux", () => {
            Object.defineProperty(navigator, "platform", {
                value: "Linux x86_64",
                configurable: true,
            });
            expect(modKey()).toBe("Ctrl");
        });

        it("returns 'Ctrl' as fallback for unknown platform", () => {
            Object.defineProperty(navigator, "platform", {
                value: "Unknown",
                configurable: true,
            });
            expect(modKey()).toBe("Ctrl");
        });
    });
});

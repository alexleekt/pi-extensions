import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendToGlimpse, sendCancelled } from "../glimpse.js";

vi.mock("../settings.js", () => ({
    getCurrentMode: () => "system",
    getCurrentAnimationLevel: () => "all",
    getCurrentContentZoom: () => 100,
}));

describe("glimpse", () => {
    let originalGlimpse: unknown;

    beforeEach(() => {
        originalGlimpse = (window as unknown as Record<string, unknown>).glimpse;
    });

    afterEach(() => {
        (window as unknown as Record<string, unknown>).glimpse = originalGlimpse;
    });

    it("sendToGlimpse calls window.glimpse.send when bridge exists", () => {
        const mockSend = vi.fn();
        (window as unknown as Record<string, unknown>).glimpse = {
            send: mockSend,
        };
        sendToGlimpse({ foo: "bar" });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(
            expect.objectContaining({
                foo: "bar",
                __theme: "system",
                __animationLevel: "all",
                __contentZoom: 100,
            }),
        );
    });

    it("sendToGlimpse throws 'Glimpse bridge not available' when window.glimpse is undefined", () => {
        (window as unknown as Record<string, unknown>).glimpse = undefined;
        expect(() => sendToGlimpse({})).toThrow("Glimpse bridge not available");
    });

    it("sendCancelled calls sendToGlimpse with correct payload", () => {
        const mockSend = vi.fn();
        (window as unknown as Record<string, unknown>).glimpse = {
            send: mockSend,
        };
        sendCancelled();
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend).toHaveBeenCalledWith(
            expect.objectContaining({
                __cancelled: true,
                __theme: "system",
                __animationLevel: "all",
                __contentZoom: 100,
            }),
        );
    });

    it("sendCancelled throws when window.glimpse is undefined", () => {
        (window as unknown as Record<string, unknown>).glimpse = undefined;
        expect(() => sendCancelled()).toThrow("Glimpse bridge not available");
    });
});

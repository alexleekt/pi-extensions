import { afterEach, describe, expect, it } from "vitest";
import { isAskDebugEnabled } from "../../index.js";

describe("isAskDebugEnabled", () => {
    const original = process.env.PI_ASK_USER_DEBUG;

    afterEach(() => {
        if (original === undefined) {
            delete process.env.PI_ASK_USER_DEBUG;
        } else {
            process.env.PI_ASK_USER_DEBUG = original;
        }
    });

    it("is disabled by default", () => {
        delete process.env.PI_ASK_USER_DEBUG;
        expect(isAskDebugEnabled()).toBe(false);
    });

    it("accepts explicit truthy values", () => {
        for (const value of ["1", "true", "TRUE", "yes"]) {
            process.env.PI_ASK_USER_DEBUG = value;
            expect(isAskDebugEnabled()).toBe(true);
        }
    });

    it("rejects non-truthy values", () => {
        for (const value of ["0", "false", "debug", ""]) {
            process.env.PI_ASK_USER_DEBUG = value;
            expect(isAskDebugEnabled()).toBe(false);
        }
    });
});

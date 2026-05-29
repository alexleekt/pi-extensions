// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { describe, expect, test } from "bun:test";
import { getState, replayBranch, setState, exposeHeading, clearExposure } from "./store.js";

function makeCtx(entries: unknown[]): {
    sessionManager: { getBranch: () => unknown[]; getLeafId: () => string };
} {
    return {
        sessionManager: {
            getBranch: () => entries,
            getLeafId: () => "leaf-1",
        },
    };
}

describe("replayBranch", () => {
    test("returns undefined when branch is empty", () => {
        const ctx = makeCtx([]);
        expect(replayBranch(ctx)).toBeUndefined();
    });

    test("restores state from entry.data", () => {
        const ctx = makeCtx([
            {
                type: "custom",
                customType: "heading",
                data: { topic: "Docker", goal: "Fix compose setup" },
            },
        ]);
        const state = replayBranch(ctx);
        expect(state).toEqual({ topic: "Docker", goal: "Fix compose setup" });
        expect(getState("leaf-1")).toEqual({
            topic: "Docker",
            goal: "Fix compose setup",
        });
    });

    test("falls back to entry.detail for backward compat", () => {
        const ctx = makeCtx([
            {
                type: "custom",
                customType: "heading",
                detail: { topic: "Auth", goal: "Refactor login flow" },
            },
        ]);
        const state = replayBranch(ctx);
        expect(state).toEqual({ topic: "Auth", goal: "Refactor login flow" });
    });

    test("prefers .data over .detail when both present", () => {
        const ctx = makeCtx([
            {
                type: "custom",
                customType: "heading",
                data: { topic: "New", goal: "New goal" },
                detail: { topic: "Old", goal: "Old goal" },
            },
        ]);
        const state = replayBranch(ctx);
        expect(state).toEqual({ topic: "New", goal: "New goal" });
    });

    test("ignores non-heading custom entries", () => {
        const ctx = makeCtx([
            {
                type: "custom",
                customType: "other-ext",
                data: { topic: "X", goal: "Y" },
            },
        ]);
        expect(replayBranch(ctx)).toBeUndefined();
    });

    test("ignores entries missing topic or goal", () => {
        const ctx = makeCtx([
            {
                type: "custom",
                customType: "heading",
                data: { goal: "Missing topic" },
            },
        ]);
        expect(replayBranch(ctx)).toBeUndefined();
    });

    test("uses most recent heading entry", () => {
        const ctx = makeCtx([
            {
                type: "custom",
                customType: "heading",
                data: { topic: "First", goal: "First goal" },
            },
            {
                type: "message",
                message: { role: "user", content: "hi" },
            },
            {
                type: "custom",
                customType: "heading",
                data: { topic: "Latest", goal: "Latest goal" },
            },
        ]);
        const state = replayBranch(ctx);
        expect(state).toEqual({ topic: "Latest", goal: "Latest goal" });
    });
});

describe("getState / setState", () => {
    test("round-trip stores and retrieves state", () => {
        const state = { topic: "Docker", goal: "Fix compose", achievement: "Done" };
        setState("leaf-2", state);
        expect(getState("leaf-2")).toEqual(state);
    });

    test("returns undefined for nonexistent leaf", () => {
        expect(getState("nonexistent")).toBeUndefined();
    });
});

describe("exposeHeading", () => {
    test("emits correct payload with achievement", () => {
        const emitted: { channel: string; data: unknown }[] = [];
        const pi = {
            events: {
                emit: (channel: string, data: unknown) => {
                    emitted.push({ channel, data });
                },
            },
        } as any;
        exposeHeading(pi, { topic: "Docker", goal: "Fix compose", achievement: "Done" }, "achievement");
        expect(emitted.length).toBe(1);
        expect(emitted[0].channel).toBe("heading:state");
        expect(emitted[0].data).toEqual({
            topic: "Docker",
            goal: "Fix compose",
            achievement: "Done",
            mode: "achievement",
        });
    });

    test("emits correct payload without achievement", () => {
        const emitted: { channel: string; data: unknown }[] = [];
        const pi = {
            events: {
                emit: (channel: string, data: unknown) => {
                    emitted.push({ channel, data });
                },
            },
        } as any;
        exposeHeading(pi, { topic: "Docker", goal: "Fix compose" }, "goal");
        expect(emitted.length).toBe(1);
        expect(emitted[0].data).toEqual({
            topic: "Docker",
            goal: "Fix compose",
            mode: "goal",
        });
    });
});

describe("clearExposure", () => {
    test("emits idle payload", () => {
        const emitted: { channel: string; data: unknown }[] = [];
        const pi = {
            events: {
                emit: (channel: string, data: unknown) => {
                    emitted.push({ channel, data });
                },
            },
        } as any;
        clearExposure(pi);
        expect(emitted.length).toBe(1);
        expect(emitted[0].channel).toBe("heading:state");
        expect(emitted[0].data).toEqual({
            topic: "",
            goal: "",
            mode: "idle",
        });
    });
});

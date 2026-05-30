// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { describe, expect, test } from "bun:test";
import {
    clearExposure,
    deleteState,
    exposeHeading,
    getState,
    persistState,
    replayBranch,
    setState,
} from "./store.js";

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
        const state = {
            topic: "Docker",
            goal: "Fix compose",
            achievement: "Done",
        };
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
        exposeHeading(
            pi,
            { topic: "Docker", goal: "Fix compose", achievement: "Done" },
            "achievement",
        );
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

describe("deleteState", () => {
    test("removes a leaf from in-memory store", () => {
        setState("leaf-del", { topic: "X", goal: "Y" });
        expect(getState("leaf-del")).toEqual({ topic: "X", goal: "Y" });
        deleteState("leaf-del");
        expect(getState("leaf-del")).toBeUndefined();
    });

    test("is a no-op for nonexistent leaf", () => {
        expect(() => deleteState("nonexistent")).not.toThrow();
    });
});

describe("persistState", () => {
    test("calls appendEntry with correct key and state", () => {
        const entries: { key: string; data: unknown }[] = [];
        const pi = {
            appendEntry: (key: string, data: unknown) => {
                entries.push({ key, data });
            },
            events: {
                emit: () => {},
            },
        } as any;
        const state = { topic: "Docker", goal: "Fix compose" };
        persistState(pi, state);
        expect(entries.length).toBe(1);
        expect(entries[0].key).toBe("heading");
        expect(entries[0].data).toEqual(state);
    });
});

describe("exposeHeading deduplication", () => {
    test("skips duplicate emissions with identical payload", () => {
        const emitted: { channel: string; data: unknown }[] = [];
        const pi = {
            events: {
                emit: (channel: string, data: unknown) => {
                    emitted.push({ channel, data });
                },
            },
        } as any;
        const state = { topic: "Docker", goal: "Fix compose" };
        exposeHeading(pi, state, "goal");
        exposeHeading(pi, state, "goal");
        expect(emitted.length).toBe(1);
    });

    test("emits again when payload changes", () => {
        const emitted: { channel: string; data: unknown }[] = [];
        const pi = {
            events: {
                emit: (channel: string, data: unknown) => {
                    emitted.push({ channel, data });
                },
            },
        } as any;
        // Use a separate pi to clear lastEmitted without polluting our emitted array
        clearExposure({ events: { emit: () => {} } } as any);
        exposeHeading(pi, { topic: "Docker", goal: "Fix compose" }, "goal");
        exposeHeading(pi, { topic: "Docker", goal: "Fix compose" }, "working");
        expect(emitted.length).toBe(2);
    });

    test("clears dedup state after clearExposure", () => {
        const emitted: { channel: string; data: unknown }[] = [];
        const pi = {
            events: {
                emit: (channel: string, data: unknown) => {
                    emitted.push({ channel, data });
                },
            },
        } as any;
        const state = { topic: "Docker", goal: "Fix compose" };
        exposeHeading(pi, state, "goal");
        clearExposure(pi);
        exposeHeading(pi, state, "goal");
        expect(emitted.length).toBe(3);
    });
});

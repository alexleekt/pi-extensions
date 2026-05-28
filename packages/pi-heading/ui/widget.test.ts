// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { describe, expect, test } from "bun:test";
import { clearHeading, setHeadingMessage } from "./widget.js";

function createMockCtx() {
    const workingMessages: (string | undefined)[] = [];
    return {
        ui: {
            setWorkingMessage: (msg?: string) => {
                workingMessages.push(msg);
            },
        },
        _workingMessages: workingMessages,
    } as any;
}

describe("setHeadingMessage", () => {
    test("renders goal by default", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Fix the bug");
        expect(ctx._workingMessages).toEqual(["Fix the bug"]);
    });

    test("renders achievement", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Bug is fixed", "achievement");
        expect(ctx._workingMessages).toEqual(["Bug is fixed"]);
    });

    test("renders working", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Working on it", "working");
        expect(ctx._workingMessages).toEqual(["Working on it"]);
    });

    test("clears working message when text is empty", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "");
        expect(ctx._workingMessages).toEqual([undefined]);
    });

    test("clears working message when text is whitespace only", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "   ");
        expect(ctx._workingMessages).toEqual([undefined]);
    });

    test("clears working message when mode is idle", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Something", "idle");
        expect(ctx._workingMessages).toEqual([undefined]);
    });

    test("trims text before rendering", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "  Fix the bug  ");
        expect(ctx._workingMessages).toEqual(["Fix the bug"]);
    });
});

describe("clearHeading", () => {
    test("clears working message", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Fix the bug");
        clearHeading(ctx);
        expect(ctx._workingMessages).toEqual(["Fix the bug", undefined]);
    });
});

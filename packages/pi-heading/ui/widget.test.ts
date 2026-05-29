// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { afterEach, describe, expect, test } from "bun:test";
import { clearHeading, setHeadingMessage, stopSpinner } from "./widget.js";

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

afterEach(() => {
    stopSpinner();
});

describe("setHeadingMessage", () => {
    test("renders goal by default", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Fix the bug");
        expect(ctx._workingMessages).toEqual(["▸ Fix the bug"]);
    });

    test("renders text in achievement mode", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Bug is fixed", "achievement");
        expect(ctx._workingMessages).toEqual(["✓ Bug is fixed"]);
    });

    test("renders text in goal mode", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Fix the bug", "goal");
        expect(ctx._workingMessages).toEqual(["▸ Fix the bug"]);
    });

    test("renders working with first spinner frame", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Working on it", "working");
        expect(ctx._workingMessages[0]).toBe("⠋ Working on it");
        clearHeading(ctx);
    });

    test("clears working message when text is empty", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "");
        expect(ctx._workingMessages).toEqual([""]);
    });

    test("clears working message when text is whitespace only", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "   ");
        expect(ctx._workingMessages).toEqual([""]);
    });

    test("clears working message when mode is idle", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Something", "idle");
        expect(ctx._workingMessages).toEqual([""]);
    });

    test("trims text before rendering", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "  Fix the bug  ");
        expect(ctx._workingMessages).toEqual(["▸ Fix the bug"]);
    });
});

describe("clearHeading", () => {
    test("clears working message with empty string", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Fix the bug");
        clearHeading(ctx);
        expect(ctx._workingMessages).toEqual(["▸ Fix the bug", ""]);
    });
});

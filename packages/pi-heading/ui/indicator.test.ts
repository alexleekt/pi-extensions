// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { describe, expect, test } from "bun:test";
import { clearHeading, setHeadingMessage } from "./indicator.js";

function createMockCtx() {
    const workingMessages: (string | undefined)[] = [];
    const widgets: { key: string; lines?: string[] }[] = [];
    return {
        hasUI: true,
        ui: {
            setWorkingMessage: (msg?: string) => {
                workingMessages.push(msg);
            },
            setWidget: (key: string, lines?: string[]) => {
                widgets.push({ key, lines });
            },
        },
        _workingMessages: workingMessages,
        _widgets: widgets,
        _lastWidget: () =>
            [...widgets].reverse().find((w) => w.lines !== undefined),
    } as any;
}

describe("setHeadingMessage", () => {
    test("renders goal text without a decorative prefix", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Fix the bug");
        expect(ctx._workingMessages).toEqual(["Fix the bug"]);
        expect(ctx._lastWidget()).toBeUndefined();
    });

    test("renders achievement as a checkmarked widget, not the working row", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Bug is fixed", "achievement");
        const last = ctx._lastWidget();
        expect(typeof last?.lines).toBe("function");
        // The factory resolves through the theme: success ✓ + muted text.
        const rendered = last.lines(
            {},
            {
                fg: (color: string, t: string) => `[${color}]${t}`,
            },
        ).text;
        expect(rendered).toContain("[success]✓ ");
        expect(rendered).toContain("[muted]Bug is fixed");
        expect(ctx._workingMessages).toEqual([""]);
    });

    test("renders working text through the same working message", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Working on it", "working");
        expect(ctx._workingMessages).toEqual(["Working on it"]);
        expect(ctx._lastWidget()).toBeUndefined();
    });

    test("sanitizes displayed text", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, `\x1b[31munsafe\x1b[0m\n${"x".repeat(250)}`);
        expect(ctx._workingMessages[0]).toBe(`unsafe${"x".repeat(194)}`);
    });

    test("clears working message when text is empty", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "");
        expect(ctx._workingMessages).toEqual([""]);
        expect(ctx._lastWidget()?.lines).toBeUndefined();
    });

    test("clearHeading clears both the widget and the working message", () => {
        const ctx = createMockCtx();
        setHeadingMessage(ctx, "Done", "achievement");
        clearHeading(ctx);
        // The last widget call is the clear (no lines), superseding "✓ Done".
        expect(ctx._widgets.at(-1)?.lines).toBeUndefined();
        expect(ctx._workingMessages.at(-1)).toBe("");
    });
});

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { renderWidget, clearWidget, stopSpinner, isSpinnerRunning } from "./widget.js";

function createMockCtx() {
  const setWidget = (_key: string, _lines: string[] | undefined) => {};
  const fg = (_color: string, text: string) => text;
  return {
    ui: {
      theme: { fg },
      setWidget,
    },
  } as any;
}

describe("renderWidget", () => {
  test("renders goal with ▸ prefix by default", () => {
    const ctx = createMockCtx();
    let captured: [string, string[] | undefined] | undefined;
    ctx.ui.setWidget = (key: string, lines: string[] | undefined) => {
      captured = [key, lines];
    };
    renderWidget(ctx, "Fix the bug");
    expect(captured).toEqual(["pi-heading", ["▸ Fix the bug"]]);
  });

  test("renders achievement with ✓ prefix", () => {
    const ctx = createMockCtx();
    let captured: [string, string[] | undefined] | undefined;
    ctx.ui.setWidget = (key: string, lines: string[] | undefined) => {
      captured = [key, lines];
    };
    renderWidget(ctx, "Bug is fixed", "achievement");
    expect(captured).toEqual(["pi-heading", ["✓ Bug is fixed"]]);
  });

  test("clears widget when text is empty", () => {
    const ctx = createMockCtx();
    let captured: [string, string[] | undefined] | undefined;
    ctx.ui.setWidget = (key: string, lines: string[] | undefined) => {
      captured = [key, lines];
    };
    renderWidget(ctx, "");
    expect(captured).toEqual(["pi-heading", undefined]);
  });

  test("clears widget when text is whitespace only", () => {
    const ctx = createMockCtx();
    let captured: [string, string[] | undefined] | undefined;
    ctx.ui.setWidget = (key: string, lines: string[] | undefined) => {
      captured = [key, lines];
    };
    renderWidget(ctx, "   ");
    expect(captured).toEqual(["pi-heading", undefined]);
  });
});

describe("working mode", () => {
  beforeEach(() => {
    stopSpinner();
  });
  afterEach(() => {
    stopSpinner();
  });

  test("starts with Braille spinner prefix", () => {
    const ctx = createMockCtx();
    let captured: [string, string[] | undefined] | undefined;
    ctx.ui.setWidget = (key: string, lines: string[] | undefined) => {
      captured = [key, lines];
    };
    renderWidget(ctx, "Working on it", "working");
    expect(captured).toEqual(["pi-heading", ["⠋ Working on it"]]);
  });

  test("spinner advances frames over time", async () => {
    const ctx = createMockCtx();
    const calls: [string, string[] | undefined][] = [];
    ctx.ui.setWidget = (key: string, lines: string[] | undefined) => {
      calls.push([key, lines]);
    };
    renderWidget(ctx, "Working", "working");

    // Wait long enough for at least two interval ticks
    await new Promise((r) => setTimeout(r, 300));

    // Should have initial call + at least two interval updates
    expect(calls.length).toBeGreaterThan(2);

    // All calls should have the same key and text, but prefixes should rotate
    const prefixes = calls.map((c) => (c[1]?.[0] ?? "").split(" ")[0]);
    expect(prefixes[0]).toBe("⠋");
    expect(prefixes[prefixes.length - 1]).not.toBe("⠋");
  });

  test("spinner is a no-op when already running with same text", async () => {
    const ctx = createMockCtx();
    const calls: [string, string[] | undefined][] = [];
    ctx.ui.setWidget = (key: string, lines: string[] | undefined) => {
      calls.push([key, lines]);
    };
    renderWidget(ctx, "Working", "working");

    // Wait for one tick
    await new Promise((r) => setTimeout(r, 200));
    const callCountAfterFirst = calls.length;

    // Re-render with same text — should not thrash the interval
    renderWidget(ctx, "Working", "working");

    // Wait for another tick
    await new Promise((r) => setTimeout(r, 200));

    // The second render should not have reset the interval; total calls should
    // continue accumulating smoothly (not restart from frame 0).
    expect(calls.length).toBeGreaterThan(callCountAfterFirst + 1);
  });
});

describe("clearWidget", () => {
  test("clears widget and stops spinner", () => {
    const ctx = createMockCtx();
    let captured: [string, string[] | undefined] | undefined;
    ctx.ui.setWidget = (key: string, lines: string[] | undefined) => {
      captured = [key, lines];
    };
    renderWidget(ctx, "Working", "working");
    clearWidget(ctx);
    expect(captured).toEqual(["pi-heading", undefined]);
  });
});

describe("isSpinnerRunning", () => {
  beforeEach(() => {
    stopSpinner();
  });
  afterEach(() => {
    stopSpinner();
  });

  test("returns false when spinner is stopped", () => {
    expect(isSpinnerRunning()).toBe(false);
  });

  test("returns true when spinner is active", () => {
    const ctx = createMockCtx();
    renderWidget(ctx, "Working", "working");
    expect(isSpinnerRunning()).toBe(true);
  });

  test("returns false after clearWidget", () => {
    const ctx = createMockCtx();
    renderWidget(ctx, "Working", "working");
    clearWidget(ctx);
    expect(isSpinnerRunning()).toBe(false);
  });
});

describe("spinner resilience", () => {
  beforeEach(() => {
    stopSpinner();
  });
  afterEach(() => {
    stopSpinner();
  });

  test("survives setWidget throwing inside interval", async () => {
    const ctx = createMockCtx();
    let callCount = 0;
    ctx.ui.setWidget = () => {
      callCount++;
      if (callCount === 2) throw new Error("widget crash");
    };
    renderWidget(ctx, "Working", "working");

    // Wait for at least three interval ticks; the second throws,
    // but the interval should keep firing.
    await new Promise((r) => setTimeout(r, 400));

    expect(callCount).toBeGreaterThan(2);
    expect(isSpinnerRunning()).toBe(true);
  });
});

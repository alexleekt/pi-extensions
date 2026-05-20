// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { describe, expect, test } from "bun:test";
import { getState, setState, replayBranch, type State } from "./store.js";

function makeCtx(entries: any[]): any {
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
    expect(getState("leaf-1")).toEqual({ topic: "Docker", goal: "Fix compose setup" });
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

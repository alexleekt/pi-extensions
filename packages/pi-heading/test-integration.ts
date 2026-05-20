// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

/**
 * Integration test: simulates the full pi-heading lifecycle with real module imports.
 *
 * This script mocks the Pi ExtensionAPI and ExtensionContext, loads the extension,
 * and verifies the widget renders correctly on session replay from .data.
 */

import { replayBranch, getState, setState } from "./state/store.js";
import { renderWidget, clearWidget } from "./ui/widget.js";

// ── Mocks ──────────────────────────────────────────────────────

const widgetCalls: { key: string; lines?: string[] }[] = [];

const theme = {
  fg: (color: string, text: string) => `[${color}:${text}]`,
};

const mockCtx = {
  sessionManager: {
    getBranch: () => [] as any[],
    getLeafId: () => "leaf-test",
  },
  ui: {
    theme,
    setWidget: (key: string, lines?: any) => {
      widgetCalls.push({ key, lines: lines ? lines : undefined });
    },
    notify: (msg: string, type: string) => {
      console.log(`[notify:${type}] ${msg}`);
    },
  },
};

// ── Assertions ─────────────────────────────────────────────────

function assertEqual(actual: any, expected: any, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`❌ FAIL: ${label}`);
    console.error(`   expected: ${e}`);
    console.error(`   actual:   ${a}`);
    process.exit(1);
  }
  console.log(`✅ ${label}`);
}

function assert(condition: boolean, label: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`✅ ${label}`);
}

// ── Test 1: replayBranch from .data ────────────────────────────

console.log("\n📋 Test 1: replayBranch restores from entry.data");
widgetCalls.length = 0;

const branchWithData = [
  { type: "custom", customType: "heading", data: { topic: "Docker", goal: "Fix compose setup" } },
];
(mockCtx as any).sessionManager.getBranch = () => branchWithData;

const state1 = replayBranch(mockCtx as any);
assertEqual(state1, { topic: "Docker", goal: "Fix compose setup" }, "restored state matches .data");
assertEqual(getState("leaf-test"), { topic: "Docker", goal: "Fix compose setup" }, "memory has state");

// Render the widget from the restored state
renderWidget(mockCtx as any, state1!.goal);
assert(widgetCalls.length === 1, "widget was called once");
assertEqual(widgetCalls[0].key, "pi-heading", "widget key is correct");
assert(Boolean(widgetCalls[0].lines && widgetCalls[0].lines.length > 0), "widget has lines");
assert(Boolean(widgetCalls[0].lines![0].includes("Fix compose setup")), "widget shows the goal");

// ── Test 2: replayBranch from .detail (backward compat) ────────

console.log("\n📋 Test 2: replayBranch falls back to entry.detail");
widgetCalls.length = 0;

const branchWithDetail = [
  { type: "custom", customType: "heading", detail: { topic: "Auth", goal: "Refactor login" } },
];
(mockCtx as any).sessionManager.getBranch = () => branchWithDetail;

const state2 = replayBranch(mockCtx as any);
assertEqual(state2, { topic: "Auth", goal: "Refactor login" }, "restored state matches .detail");

// ── Test 3: empty goal clears widget ───────────────────────────

console.log("\n📋 Test 3: empty goal clears widget");
widgetCalls.length = 0;

renderWidget(mockCtx as any, "");
assert(widgetCalls.length === 1, "widget was called");
assertEqual(widgetCalls[0].key, "pi-heading", "widget key is correct");
assert(widgetCalls[0].lines === undefined, "widget is cleared with undefined");

// ── Test 4: clearWidget ──────────────────────────────────────

console.log("\n📋 Test 4: clearWidget clears the widget");
widgetCalls.length = 0;

clearWidget(mockCtx as any);
assert(widgetCalls.length === 1, "widget was called");
assertEqual(widgetCalls[0].key, "pi-heading", "widget key is correct");
assert(widgetCalls[0].lines === undefined, "widget is cleared");

// ── Test 5: replayBranch ignores wrong customType ─────────────

console.log("\n📋 Test 5: replayBranch ignores non-heading entries");
widgetCalls.length = 0;

const branchWithOther = [
  { type: "custom", customType: "other-ext", data: { topic: "X", goal: "Y" } },
];
(mockCtx as any).sessionManager.getBranch = () => branchWithOther;

const state5 = replayBranch(mockCtx as any);
assertEqual(state5, undefined, "returns undefined for wrong customType");

// ── Summary ────────────────────────────────────────────────────

console.log("\n🎉 All integration tests passed!\n");

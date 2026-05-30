// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { setModelOverride } from "./llm/picker.js";
import {
    DEBUG_LOG,
    logDebug,
    readDebugLog,
    setDebugEnabled,
    setDebugLogPath,
    setDebugMode,
} from "./state/debug.js";
// Import real internal modules — we verify through their side effects
import { clearState, setState } from "./state/store.js";

// Mock the external LLM dependency so summarize() doesn't make real API calls
const mockCompleteSimple = mock(() =>
    Promise.resolve({
        role: "assistant",
        content: [{ type: "text", text: '{"result": "Docker setup"}' }],
        api: "openai-completions",
        provider: "openai",
        model: "test-model",
        usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0,
            },
        },
        stopReason: "stop",
        timestamp: Date.now(),
    } as any),
);

mock.module("@earendil-works/pi-ai", () => ({
    completeSimple: (...args: any[]) => mockCompleteSimple(...args),
}));

// ── Build mock Pi and context ───────────────────────────────────

interface HandlerMap {
    [event: string]: ((event: any, ctx: any) => void | Promise<void>)[];
}

function makeMockPi() {
    const handlers: HandlerMap = {};
    const commands: {
        [name: string]: {
            description: string;
            handler: (args: string, ctx: any) => Promise<void>;
        };
    } = {};
    const entries: any[] = [];
    const eventEmissions: { channel: string; data: unknown }[] = [];
    const sendMessageCalls: any[] = [];

    return {
        handlers,
        commands,
        entries,
        eventEmissions,
        sendMessageCalls,
        on: (event: string, handler: any) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(handler);
        },
        registerCommand: (name: string, config: any) => {
            commands[name] = config;
        },
        appendEntry: (key: string, data: any) => {
            entries.push({ key, data });
        },
        events: {
            emit: (channel: string, data: unknown) => {
                eventEmissions.push({ channel, data });
            },
        },
        sendMessage: async (message: any, options?: any) => {
            sendMessageCalls.push({ message, options });
        },
    };
}

function makeMockCtx(
    opts: {
        hasUI?: boolean;
        leafId?: string;
        branch?: any[];
        modelId?: string;
        models?: any[];
        auth?: { ok: boolean; apiKey?: string; headers?: any };
        inputResult?: string;
        selectResult?: string;
    } = {},
) {
    const {
        hasUI = true,
        leafId = "leaf-1",
        branch = [],
        modelId = "test-model",
        models = [{ id: "test-model", api: "openai" }],
        auth = { ok: true, apiKey: "fake-key" },
        inputResult = "Manual heading",
        selectResult = "test-model",
    } = opts;

    const notifyCalls: any[] = [];
    const workingVisibleCalls: boolean[] = [];
    const workingMessageCalls: (string | undefined)[] = [];

    return {
        hasUI,
        notifyCalls,
        workingVisibleCalls,
        workingMessageCalls,
        sessionManager: {
            getLeafId: () => leafId,
            getBranch: () => branch,
        },
        model: { id: modelId },
        modelRegistry: {
            getAvailable: () => models,
            getApiKeyAndHeaders: async () => auth,
        },
        ui: {
            notify: (msg: string, type?: string) => {
                notifyCalls.push({ msg, type });
            },
            setWorkingVisible: (visible: boolean) => {
                workingVisibleCalls.push(visible);
            },
            setWorkingMessage: (msg?: string) => {
                workingMessageCalls.push(msg);
            },
            theme: {
                fg: (_style: string, text: string) => text,
            },
            input: async (_prompt: string) => inputResult,
            select: async (_prompt: string, _choices: string[]) => selectResult,
        },
    };
}

// ── Import the extension (uses the mocked pi-ai) ────────────────

const { default: headingExtension } = await import("./index.js");

// ── Tests ───────────────────────────────────────────────────────

describe("headingExtension", () => {
    let pi: ReturnType<typeof makeMockPi>;
    let tmpConfigDir: string;

    beforeEach(() => {
        pi = makeMockPi();
        mockCompleteSimple.mockClear();
        mockCompleteSimple.mockImplementation(() =>
            Promise.resolve({
                role: "assistant",
                content: [{ type: "text", text: '{"result": "Docker setup"}' }],
                api: "openai-completions",
                provider: "openai",
                model: "test-model",
                usage: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 0,
                    cost: {
                        input: 0,
                        output: 0,
                        cacheRead: 0,
                        cacheWrite: 0,
                        total: 0,
                    },
                },
                stopReason: "stop",
                timestamp: Date.now(),
            } as any),
        );

        setDebugEnabled(false);
        // Reset debug log path to default so we always write to the canonical log
        setDebugLogPath(DEBUG_LOG);
        try {
            fs.unlinkSync(DEBUG_LOG);
        } catch {
            /* ignore */
        }

        // Use temp config dir to avoid polluting real config
        tmpConfigDir = path.join(
            os.tmpdir(),
            `pi-heading-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        fs.mkdirSync(tmpConfigDir, { recursive: true });

        // Reset debug mode config
        setDebugMode(false, tmpConfigDir);
        setModelOverride(undefined, tmpConfigDir);
        // Also clear the default config dir to prevent cross-test pollution
        setModelOverride(undefined);
        clearState();
    });

    afterEach(() => {
        try {
            fs.rmSync(tmpConfigDir, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
        // Clear default config dir pollution from heading-model tests
        setModelOverride(undefined);
        // Reset debug log path to default in case another test file changed it
        setDebugLogPath(DEBUG_LOG);
    });

    test("registers 7 hooks and 3 commands", () => {
        headingExtension(pi as any);
        expect(Object.keys(pi.handlers)).toEqual([
            "session_start",
            "agent_end",
            "session_shutdown",
            "before_agent_start",
            "agent_start",
            "turn_start",
            "turn_end",
        ]);
        expect(Object.keys(pi.commands)).toEqual([
            "heading",
            "heading-model",
            "heading-debug",
        ]);
    });

    test("no handler calls setWorkingVisible", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        // Fire every handler that touches UI
        pi.handlers.session_start[0]({}, ctx);
        pi.handlers.before_agent_start[0]({ prompt: "test" }, ctx);
        pi.handlers.agent_start[0]({}, ctx);
        pi.handlers.turn_start[0]({}, ctx);
        pi.handlers.agent_end[0]({}, ctx);
        pi.handlers.session_shutdown[0]({}, ctx);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    // ── session_start ────────────────────────────────────────────

    test("session_start replays achievement mode when achievement exists", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({
            branch: [
                {
                    type: "custom",
                    customType: "heading",
                    data: {
                        topic: "Docker",
                        goal: "Fix compose",
                        achievement: "Fixed it",
                    },
                },
            ],
        });
        await pi.handlers.session_start[0]({}, ctx);
        expect(ctx.workingMessageCalls.length).toBeGreaterThan(0);
        expect(ctx.workingMessageCalls[0]).toContain("Fix compose");
        // Event bus preserves achievement mode across sessions
        expect(
            pi.eventEmissions.some(
                (e) =>
                    e.channel === "heading:state" &&
                    (e.data as any).mode === "achievement",
            ),
        ).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("session_start replays goal when no achievement", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({
            branch: [
                {
                    type: "custom",
                    customType: "heading",
                    data: { topic: "Docker", goal: "Fix compose" },
                },
            ],
        });
        await pi.handlers.session_start[0]({}, ctx);
        expect(ctx.workingMessageCalls.length).toBeGreaterThan(0);
        expect(ctx.workingMessageCalls[0]).toContain("Fix compose");
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("session_start clears heading when no replay", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.handlers.session_start[0]({}, ctx);
        expect(ctx.workingMessageCalls.some((m) => m === "")).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("session_start does nothing when hasUI is false", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ hasUI: false });
        await pi.handlers.session_start[0]({}, ctx);
        expect(ctx.workingMessageCalls.length).toBe(0);
    });

    // ── agent_end ────────────────────────────────────────────────

    test("agent_end preserves achievement mode when achievement exists", () => {
        setState("leaf-1", {
            topic: "Docker",
            goal: "Fix compose",
            achievement: "Fixed it",
        });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.agent_end[0]({}, ctx);
        expect(
            ctx.workingMessageCalls.some((m) => m?.includes("Fixed it")),
        ).toBe(true);
        // Event bus preserves achievement mode after the agent ends
        expect(
            pi.eventEmissions.some(
                (e) =>
                    e.channel === "heading:state" &&
                    (e.data as any).mode === "achievement",
            ),
        ).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("agent_end keeps working message visible with goal when no achievement", () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.agent_end[0]({}, ctx);
        expect(
            ctx.workingMessageCalls.some((m) => m?.includes("Fix compose")),
        ).toBe(true);
        expect(
            pi.eventEmissions.some(
                (e) =>
                    e.channel === "heading:state" &&
                    (e.data as any).mode === "goal",
            ),
        ).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("agent_end clears everything when no state", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ leafId: "leaf-no-state" });
        pi.handlers.agent_end[0]({}, ctx);
        expect(ctx.workingMessageCalls.some((m) => m === "")).toBe(true);
        expect(
            pi.eventEmissions.some(
                (e) =>
                    e.channel === "heading:state" &&
                    (e.data as any).mode === "idle",
            ),
        ).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    // ── session_shutdown ───────────────────────────────────────

    test("session_shutdown clears heading and exposes idle mode", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.handlers.session_shutdown[0]({}, ctx);
        expect(ctx.workingMessageCalls.some((m) => m === "")).toBe(true);
        expect(
            pi.eventEmissions.some(
                (e) =>
                    e.channel === "heading:state" &&
                    (e.data as any).mode === "idle",
            ),
        ).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("session_start resets sharedState and clears stale in-memory state", async () => {
        headingExtension(pi as any);
        setState("leaf-1", { topic: "Old", goal: "Old goal" });
        const ctx = makeMockCtx();
        // Simulate previous session ending
        pi.handlers.session_shutdown[0]({}, ctx);
        // New session starts — should not resurrect old state
        pi.handlers.session_start[0]({}, ctx);
        pi.handlers.turn_start[0]({}, ctx);
        // No old goal should appear
        expect(ctx.workingMessageCalls.some((m) => m?.includes("Old goal"))).toBe(false);
        expect(ctx.workingMessageCalls.some((m) => m === "")).toBe(true);
    });

    // ── before_agent_start (fire-and-forget) ─────────────────────

    test("before_agent_start triggers summarize and renders goal", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.before_agent_start[0]({ prompt: "help with docker" }, ctx);
        // Immediate placeholder is set synchronously before async summarize
        expect(ctx.workingMessageCalls.length).toBeGreaterThanOrEqual(1);
        expect(ctx.workingMessageCalls[0]).toContain("help with docker");
        await new Promise((r) => setTimeout(r, 50));
        // After summarize completes, the LLM goal replaces the placeholder
        expect(
            ctx.workingMessageCalls.some((m) => m?.includes("Docker setup")),
        ).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("before_agent_start does nothing for empty prompt", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.before_agent_start[0]({ prompt: "  " }, ctx);
        expect(ctx.workingMessageCalls.length).toBe(0);
    });

    test("before_agent_start does nothing when hasUI is false", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ hasUI: false });
        pi.handlers.before_agent_start[0]({ prompt: "help" }, ctx);
        expect(ctx.workingMessageCalls.length).toBe(0);
    });

    test("before_agent_start skips stale generation renders", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        // First call starts generation 1 and sets placeholder "first"
        pi.handlers.before_agent_start[0]({ prompt: "first" }, ctx);
        // Second call bumps to generation 2 and sets placeholder "second"
        pi.handlers.before_agent_start[0]({ prompt: "second" }, ctx);
        await new Promise((r) => setTimeout(r, 100));
        // Both placeholders should appear, and only the second call's result
        expect(ctx.workingMessageCalls.some((m) => m?.includes("first"))).toBe(
            true,
        );
        expect(ctx.workingMessageCalls.some((m) => m?.includes("second"))).toBe(
            true,
        );
        expect(
            ctx.workingMessageCalls.some((m) => m?.includes("Docker setup")),
        ).toBe(true);
        // The stale first result should NOT appear (only one "Docker setup" from the second call)
        const dockerSetups = ctx.workingMessageCalls.filter((m) =>
            m?.includes("Docker setup"),
        );
        expect(dockerSetups.length).toBe(1);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("before_agent_start falls back to prompt when goal is empty", async () => {
        mockCompleteSimple.mockImplementation(() =>
            Promise.resolve({
                role: "assistant",
                content: [{ type: "text", text: '{"result": "   "}' }],
                api: "openai-completions",
                provider: "openai",
                model: "test-model",
                usage: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 0,
                    cost: {
                        input: 0,
                        output: 0,
                        cacheRead: 0,
                        cacheWrite: 0,
                        total: 0,
                    },
                },
                stopReason: "stop",
                timestamp: Date.now(),
            } as any),
        );
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.before_agent_start[0]({ prompt: "help with docker" }, ctx);
        // Placeholder set immediately
        expect(ctx.workingMessageCalls[0]).toContain("help with docker");
        await new Promise((r) => setTimeout(r, 50));
        // Empty goal should fall back to the prompt, not leave the message blank
        expect(
            ctx.workingMessageCalls.some((m) =>
                m?.includes("help with docker"),
            ),
        ).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("before_agent_start notifies on summarize error", async () => {
        mockCompleteSimple.mockImplementation(() =>
            Promise.reject(new Error("model down")),
        );
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.before_agent_start[0]({ prompt: "help" }, ctx);
        await new Promise((r) => setTimeout(r, 50));
        expect(ctx.notifyCalls.length).toBeGreaterThan(0);
        expect(ctx.notifyCalls[0].msg).toContain("Summarize failed");
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("before_agent_start persists state when topic or goal changes", async () => {
        setState("leaf-1", { topic: "Old", goal: "Old goal" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.before_agent_start[0]({ prompt: "help" }, ctx);
        await new Promise((r) => setTimeout(r, 50));
        expect(pi.entries.length).toBeGreaterThan(0);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("before_agent_start uses working mode when agent already started", async () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        // Trigger before_agent_start
        pi.handlers.before_agent_start[0]({ prompt: "help with docker" }, ctx);
        // Trigger agent_start before async resolves
        pi.handlers.agent_start[0]({}, ctx);
        await new Promise((r) => setTimeout(r, 50));
        // The event should have mode "working" because agent started
        expect(
            pi.eventEmissions.some(
                (e) =>
                    e.channel === "heading:state" &&
                    (e.data as any).mode === "working",
            ),
        ).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("before_agent_start async does not revert widget after agent_end", async () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        // Trigger before_agent_start
        pi.handlers.before_agent_start[0]({ prompt: "help with docker" }, ctx);
        // Simulate agent completing before async resolves
        pi.handlers.agent_start[0]({}, ctx);
        pi.handlers.agent_end[0]({}, ctx);
        const endMsg = ctx.workingMessageCalls[ctx.workingMessageCalls.length - 1];
        // Now async completes
        await new Promise((r) => setTimeout(r, 50));
        const finalMsg = ctx.workingMessageCalls[ctx.workingMessageCalls.length - 1];
        // The final message should NOT revert to goal mode — it should stay at the agent_end state
        expect(finalMsg).toBe(endMsg);
    });

    // ── agent_start ──────────────────────────────────────────────

    test("agent_start sets working message with goal", () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.agent_start[0]({}, ctx);
        expect(ctx.workingMessageCalls.length).toBeGreaterThan(0);
        expect(ctx.workingMessageCalls[0]).toContain("Fix compose");
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("agent_start does nothing when hasUI is false", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ hasUI: false });
        pi.handlers.agent_start[0]({}, ctx);
        expect(ctx.workingMessageCalls.length).toBe(0);
    });

    test("agent_start preserves before_agent_start placeholder when no state exists", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.before_agent_start[0]({ prompt: "help with docker" }, ctx);
        expect(ctx.workingMessageCalls[0]).toContain("help with docker");
        // agent_start fires before summarize resolves — no state yet
        pi.handlers.agent_start[0]({}, ctx);
        expect(ctx.workingMessageCalls.some((m) => m === "")).toBe(false);
        expect(
            ctx.workingMessageCalls[ctx.workingMessageCalls.length - 1],
        ).toContain("help with docker");
    });

    test("agent_start does not call setWorkingVisible", () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.agent_start[0]({}, ctx);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    // ── turn_start ─────────────────────────────────────────────

    test("turn_start refreshes working message", () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.turn_start[0]({}, ctx);
        expect(ctx.workingMessageCalls.length).toBeGreaterThan(0);
        expect(ctx.workingMessageCalls[0]).toContain("Fix compose");
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("turn_start does nothing when hasUI is false", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ hasUI: false });
        pi.handlers.turn_start[0]({}, ctx);
        expect(ctx.workingMessageCalls.length).toBe(0);
    });

    test("turn_start preserves before_agent_start placeholder when no state exists", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.before_agent_start[0]({ prompt: "next task" }, ctx);
        expect(ctx.workingMessageCalls[0]).toContain("next task");
        pi.handlers.turn_start[0]({}, ctx);
        expect(ctx.workingMessageCalls.some((m) => m === "")).toBe(false);
        expect(
            ctx.workingMessageCalls[ctx.workingMessageCalls.length - 1],
        ).toContain("next task");
    });

    test("turn_start does not call setWorkingVisible", () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.turn_start[0]({}, ctx);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    // ── turn_end ───────────────────────────────────────────────

    test("turn_end shows achievement in widget on final turn", async () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        const msg = { content: "I fixed the bug" };
        // Final turn: no tool results
        pi.handlers.turn_end[0]({ message: msg, toolResults: [] }, ctx);
        await new Promise((r) => setTimeout(r, 50));
        // Achievement should be shown in the widget with checkmark prefix
        expect(
            ctx.workingMessageCalls.some((m) => m?.includes("Docker setup")),
        ).toBe(true);
        expect(ctx.workingMessageCalls.some((m) => m?.includes("✓"))).toBe(
            true,
        );
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("turn_end keeps working message for intermediate tool-call turns", () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        // Prime with agent_start
        pi.handlers.agent_start[0]({}, ctx);
        // Intermediate turn with tool results — should not change working message
        pi.handlers.turn_end[0](
            {
                message: { content: "Let me search" },
                toolResults: [{ role: "tool", content: "result" }],
            },
            ctx,
        );
        // Working message should still be the goal text set by agent_start (with spinner prefix)
        expect(ctx.workingMessageCalls[0]).toMatch(/^⠋ Fix compose$/);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("turn_end skips async summarize for intermediate tool-call turns", async () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        mockCompleteSimple.mockClear();
        pi.handlers.turn_end[0](
            {
                message: { content: "Let me search" },
                toolResults: [{ role: "tool", content: "result" }],
            },
            ctx,
        );
        await new Promise((r) => setTimeout(r, 50));
        // No API call should have been made for achievement summarize
        expect(mockCompleteSimple.mock.calls.length).toBe(0);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("turn_end does nothing when hasUI is false", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ hasUI: false });
        pi.handlers.turn_end[0]({ message: { content: "" } }, ctx);
        expect(ctx.workingMessageCalls.length).toBe(0);
    });

    test("turn_end skips empty assistant text", async () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.turn_end[0]({ message: { content: "" } }, ctx);
        await new Promise((r) => setTimeout(r, 50));
        // No working message changes and no API call for empty text
        expect(ctx.workingMessageCalls.length).toBe(0);
        expect(mockCompleteSimple.mock.calls.length).toBe(0);
    });

    test("turn_end skips stale generation achievement", async () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        // 1. Start a turn
        pi.handlers.before_agent_start[0]({ prompt: "first" }, ctx);
        await new Promise((r) => setTimeout(r, 50));
        // 2. Turn ends, achievement async starts
        pi.handlers.turn_end[0]({ message: { content: "done" } }, ctx);
        // 3. New user message bumps generation
        pi.handlers.before_agent_start[0]({ prompt: "second" }, ctx);
        await new Promise((r) => setTimeout(r, 100));
        // The old achievement should not have been shown in the widget (gen mismatch)
        // No achievement prefix should appear in the working messages
        expect(ctx.workingMessageCalls.some((m) => m?.includes("✓"))).toBe(
            false,
        );
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("turn_end notifies on achievement error", async () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        mockCompleteSimple.mockImplementation(() =>
            Promise.reject(new Error("model down")),
        );
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.turn_end[0]({ message: { content: "done" } }, ctx);
        await new Promise((r) => setTimeout(r, 50));
        expect(
            ctx.notifyCalls.some((n) =>
                n.msg.includes("Achievement summarize failed"),
            ),
        ).toBe(true);
        // No widget update on error
        expect(ctx.workingMessageCalls.length).toBe(0);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("turn_end updates widget with achievement on success", async () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.turn_end[0]({ message: { content: "done" } }, ctx);
        await new Promise((r) => setTimeout(r, 50));
        // Achievement should be shown in the widget
        expect(
            ctx.workingMessageCalls.some((m) => m?.includes("Docker setup")),
        ).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("turn_end skips empty achievement text", async () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        mockCompleteSimple.mockImplementation(() =>
            Promise.resolve({
                role: "assistant",
                content: [{ type: "text", text: '{"result": "   "}' }],
                api: "openai-completions",
                provider: "openai",
                model: "test-model",
                usage: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 0,
                    cost: {
                        input: 0,
                        output: 0,
                        cacheRead: 0,
                        cacheWrite: 0,
                        total: 0,
                    },
                },
                stopReason: "stop",
                timestamp: Date.now(),
            } as any),
        );
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.turn_end[0]({ message: { content: "done" } }, ctx);
        await new Promise((r) => setTimeout(r, 50));
        // No widget update for empty achievement
        expect(ctx.workingMessageCalls.length).toBe(0);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("turn_end reads fresh state after concurrent state update", async () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        // Use a delayed mock so we can update state mid-flight
        mockCompleteSimple.mockImplementationOnce(
            () =>
                new Promise((resolve) =>
                    setTimeout(() =>
                        resolve({
                            role: "assistant",
                            content: [
                                {
                                    type: "text",
                                    text: '{"result": "Updated goal"}',
                                },
                            ],
                            api: "openai-completions",
                            provider: "openai",
                            model: "test-model",
                            usage: {
                                input: 0,
                                output: 0,
                                cacheRead: 0,
                                cacheWrite: 0,
                                totalTokens: 0,
                                cost: {
                                    input: 0,
                                    output: 0,
                                    cacheRead: 0,
                                    cacheWrite: 0,
                                    total: 0,
                                },
                            },
                            stopReason: "stop",
                            timestamp: Date.now(),
                        } as any),
                    ),
                ),
        );
        // Start the turn_end async summarize
        pi.handlers.turn_end[0]({ message: { content: "done" } }, ctx);
        // While the async block is running, update the state directly
        // (e.g., a concurrent /heading command or another turn's summarize)
        setState("leaf-1", { topic: "Docker", goal: "Updated goal" });
        await new Promise((r) => setTimeout(r, 80));
        // The achievement should use the freshly updated goal
        expect(
            ctx.workingMessageCalls.some((m) => m?.includes("Updated goal")),
        ).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    // ── /heading command ─────────────────────────────────────────

    test("/heading command sets manual goal and persists", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ inputResult: "Manual goal text" });
        await pi.commands.heading.handler("", ctx);
        expect(pi.entries.length).toBeGreaterThan(0);
        expect(pi.entries[0].data.goal).toBe("Manual goal text");
        expect(ctx.workingMessageCalls.length).toBeGreaterThan(0);
        expect(ctx.notifyCalls.some((n) => n.msg.includes("Heading set"))).toBe(
            true,
        );
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("/heading command does nothing for empty input", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ inputResult: "" });
        await pi.commands.heading.handler("", ctx);
        expect(pi.entries.length).toBe(0);
    });

    test("/heading command does nothing when hasUI is false", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ hasUI: false });
        await pi.commands.heading.handler("", ctx);
        expect(pi.entries.length).toBe(0);
    });

    // ── /heading-model command ─────────────────────────────────

    test("/heading-model shows models and sets override", async () => {
        headingExtension(pi as any);
        const models = [
            { id: "model-a", provider: "p1" },
            { id: "model-b", provider: "p2" },
        ];
        const ctx = makeMockCtx({ models, selectResult: "  model-b (p2)" });
        await pi.commands["heading-model"].handler("", ctx);
        // Verify by checking that a subsequent resolveModelId uses the override
        expect(ctx.notifyCalls.some((n) => n.msg.includes("model-b"))).toBe(
            true,
        );
    });

    test("/heading-model warns when model has no API key", async () => {
        headingExtension(pi as any);
        const models = [{ id: "model-a" }];
        const ctx = makeMockCtx({
            models,
            selectResult: "  model-a",
            auth: { ok: false },
        });
        await pi.commands["heading-model"].handler("", ctx);
        expect(ctx.notifyCalls.some((n) => n.type === "warning")).toBe(true);
    });

    test("/heading-model resets to session model", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ selectResult: "↺ Reset to session model" });
        await pi.commands["heading-model"].handler("", ctx);
        expect(ctx.notifyCalls.some((n) => n.msg.includes("reset"))).toBe(true);
    });

    test("/heading-model handles empty registry", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ models: [] });
        await pi.commands["heading-model"].handler("", ctx);
        expect(ctx.notifyCalls.some((n) => n.type === "error")).toBe(true);
    });

    test("/heading-model handles model not found after selection", async () => {
        headingExtension(pi as any);
        const models = [{ id: "model-a" }, { id: "model-b" }];
        const ctx = makeMockCtx({
            models,
            selectResult: "  nonexistent-model",
        });
        await pi.commands["heading-model"].handler("", ctx);
        expect(ctx.notifyCalls.some((n) => n.type === "error")).toBe(true);
        expect(ctx.notifyCalls.some((n) => n.msg.includes("not found"))).toBe(
            true,
        );
    });

    test("/heading-model warns when auth ok but apiKey is empty", async () => {
        headingExtension(pi as any);
        const models = [{ id: "model-a" }];
        const ctx = makeMockCtx({
            models,
            selectResult: "  model-a",
            auth: { ok: true, apiKey: "" },
        });
        await pi.commands["heading-model"].handler("", ctx);
        expect(ctx.notifyCalls.some((n) => n.type === "warning")).toBe(true);
    });

    // ── /heading-debug command ─────────────────────────────────

    test("/heading-debug on enables debug", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.commands["heading-debug"].handler("on", ctx);
        // The command writes to the default config dir, not tmpConfigDir.
        // Verify through the notification instead.
        expect(ctx.notifyCalls.some((n) => n.msg.includes("ON"))).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("/heading-debug off disables debug", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.commands["heading-debug"].handler("off", ctx);
        expect(ctx.notifyCalls.some((n) => n.msg.includes("OFF"))).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("/heading-debug clear wipes log", async () => {
        // Seed the log
        setDebugEnabled(true);
        logDebug({
            t: "2026-05-20T12:00:00Z",
            input: "test",
            prompt: "p",
            topicResponse: "",
            goalResponse: "",
            rawTopic: "",
            rawGoal: "",
            stableTopic: "",
            finalGoal: "",
            topicSystemPrompt: "",
            goalSystemPrompt: "",
        } as any);
        expect(readDebugLog(1).length).toBe(1);
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.commands["heading-debug"].handler("clear", ctx);
        expect(readDebugLog(1).length).toBe(0);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("/heading-debug shows last entries when no arg", async () => {
        setDebugEnabled(true);
        logDebug({
            t: "2026-05-20T12:00:00Z",
            input: "test",
            prompt: "p",
            topicResponse: "",
            goalResponse: "",
            rawTopic: "",
            rawGoal: "",
            stableTopic: "",
            finalGoal: "",
            topicSystemPrompt: "",
            goalSystemPrompt: "",
        } as any);
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.commands["heading-debug"].handler("", ctx);
        expect(ctx.notifyCalls.length).toBeGreaterThan(0);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("/heading-debug shows status when log is empty", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.commands["heading-debug"].handler("", ctx);
        expect(
            ctx.notifyCalls.some((n) => n.msg.includes("No debug entries")),
        ).toBe(true);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("/heading-debug formats entries with error, stream, and achievement", async () => {
        setDebugEnabled(true);
        logDebug({
            t: "2026-05-20T12:00:00Z",
            input: "test",
            prompt: "p",
            fullTopicPrompt: "",
            fullGoalPrompt: "",
            topicResponse: "",
            goalResponse: "",
            rawTopic: "",
            rawGoal: "",
            stableTopic: "",
            finalGoal: "",
            topicSystemPrompt: "",
            goalSystemPrompt: "",
            error: "model down",
            goalStream: { extractedText: "hello world", errorEvent: "timeout" },
            achievementResponse: "Fixed the bug",
        } as any);
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.commands["heading-debug"].handler("", ctx);
        const notifyMsg = ctx.notifyCalls[0]?.msg ?? "";
        expect(notifyMsg).toContain("❌");
        expect(notifyMsg).toContain("model down");
        expect(notifyMsg).toContain("📡");
        expect(notifyMsg).toContain("✓");
        expect(notifyMsg).toContain("Fixed the bug");
        expect(ctx.workingVisibleCalls).toEqual([]);
    });

    test("no handler calls setWorkingVisible", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        // Fire every handler that touches UI
        pi.handlers.session_start[0]({}, ctx);
        pi.handlers.before_agent_start[0]({ prompt: "test" }, ctx);
        pi.handlers.agent_start[0]({}, ctx);
        pi.handlers.turn_start[0]({}, ctx);
        pi.handlers.agent_end[0]({}, ctx);
        pi.handlers.session_shutdown[0]({}, ctx);
        expect(ctx.workingVisibleCalls).toEqual([]);
    });
});

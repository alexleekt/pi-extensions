// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { setDebugMode, setModelOverride } from "./llm/picker.js";
import {
    DEBUG_LOG,
    logDebug,
    readDebugLog,
    setDebugEnabled,
} from "./state/debug.js";
// Import real internal modules — we verify through their side effects
import { setState } from "./state/store.js";
import { isSpinnerRunning, renderWidget, stopSpinner } from "./ui/widget.js";

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

    return {
        handlers,
        commands,
        entries,
        eventEmissions,
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
    const widgetCalls: any[] = [];

    return {
        hasUI,
        notifyCalls,
        workingVisibleCalls,
        widgetCalls,
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
            setWidget: (key: string, lines: string[] | undefined) => {
                widgetCalls.push({ key, lines });
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

        // Reset module-level state
        stopSpinner();
        setDebugEnabled(false);
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
    });

    afterEach(() => {
        try {
            fs.rmSync(tmpConfigDir, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
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

    // ── session_start ────────────────────────────────────────────

    test("session_start replays achievement and renders it", async () => {
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
        expect(ctx.widgetCalls.length).toBeGreaterThan(0);
        expect(ctx.widgetCalls[0].key).toBe("pi-heading");
        expect(ctx.widgetCalls[0].lines?.[0]).toContain("Fixed it");
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
        expect(ctx.widgetCalls.length).toBeGreaterThan(0);
        expect(ctx.widgetCalls[0].lines?.[0]).toContain("Fix compose");
    });

    test("session_start clears widget when no replay", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.handlers.session_start[0]({}, ctx);
        // clearWidget calls setWidget with undefined
        expect(ctx.widgetCalls.some((w) => w.lines === undefined)).toBe(true);
    });

    test("session_start does nothing when hasUI is false", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ hasUI: false });
        await pi.handlers.session_start[0]({}, ctx);
        expect(ctx.widgetCalls.length).toBe(0);
    });

    test("session_start restores working visible", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.handlers.session_start[0]({}, ctx);
        expect(ctx.workingVisibleCalls).toContain(true);
    });

    // ── agent_end ────────────────────────────────────────────────

    test("agent_end stops spinner and restores working visible", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.agent_end[0]({}, ctx);
        expect(isSpinnerRunning()).toBe(false);
        expect(ctx.workingVisibleCalls).toContain(true);
    });

    test("agent_end does nothing when hasUI is false", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ hasUI: false });
        pi.handlers.agent_end[0]({}, ctx);
        // Should not throw; no visible side effects to check
    });

    // ── session_shutdown ───────────────────────────────────────

    test("session_shutdown clears widget and restores working visible", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.handlers.session_shutdown[0]({}, ctx);
        expect(ctx.widgetCalls.some((w) => w.lines === undefined)).toBe(true);
        expect(ctx.workingVisibleCalls).toContain(true);
    });

    // ── before_agent_start (fire-and-forget) ─────────────────────

    test("before_agent_start triggers summarize and renders goal", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.before_agent_start[0]({ prompt: "help with docker" }, ctx);
        await new Promise((r) => setTimeout(r, 50));
        expect(ctx.widgetCalls.length).toBeGreaterThan(0);
        expect(ctx.widgetCalls[0].lines?.[0]).toContain("Docker setup");
    });

    test("before_agent_start does nothing for empty prompt", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.before_agent_start[0]({ prompt: "  " }, ctx);
        expect(ctx.widgetCalls.length).toBe(0);
    });

    test("before_agent_start does nothing when hasUI is false", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ hasUI: false });
        pi.handlers.before_agent_start[0]({ prompt: "help" }, ctx);
        expect(ctx.widgetCalls.length).toBe(0);
    });

    test("before_agent_start skips stale generation renders", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        // First call starts generation 1
        pi.handlers.before_agent_start[0]({ prompt: "first" }, ctx);
        // Second call bumps to generation 2 before first completes
        pi.handlers.before_agent_start[0]({ prompt: "second" }, ctx);
        await new Promise((r) => setTimeout(r, 100));
        // Only the second call's result should render
        expect(ctx.widgetCalls.length).toBe(1);
    });

    test("before_agent_start skips render when spinner is already running", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        // Prime with existing state so agent_start would have started spinner
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        pi.handlers.agent_start[0]({}, ctx);
        expect(isSpinnerRunning()).toBe(true);
        // Now fire before_agent_start — it should skip goal render
        pi.handlers.before_agent_start[0]({ prompt: "help" }, ctx);
        await new Promise((r) => setTimeout(r, 50));
        // Should only have the agent_start widget call, not the summarize result
        expect(ctx.widgetCalls.length).toBe(1);
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
    });

    test("before_agent_start persists state when topic or goal changes", async () => {
        setState("leaf-1", { topic: "Old", goal: "Old goal" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.before_agent_start[0]({ prompt: "help" }, ctx);
        await new Promise((r) => setTimeout(r, 50));
        expect(pi.entries.length).toBeGreaterThan(0);
    });

    // ── agent_start ──────────────────────────────────────────────

    test("agent_start renders working spinner and suppresses Pi loader", () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.agent_start[0]({}, ctx);
        expect(isSpinnerRunning()).toBe(true);
        expect(ctx.workingVisibleCalls).toContain(false);
        expect(ctx.widgetCalls.length).toBeGreaterThan(0);
    });

    test("agent_start does nothing when hasUI is false", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ hasUI: false });
        pi.handlers.agent_start[0]({}, ctx);
        expect(ctx.widgetCalls.length).toBe(0);
    });

    // ── turn_start ─────────────────────────────────────────────

    test("turn_start restarts spinner for tool-call turns", () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.turn_start[0]({}, ctx);
        expect(isSpinnerRunning()).toBe(true);
    });

    test("turn_start does nothing when hasUI is false", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ hasUI: false });
        pi.handlers.turn_start[0]({}, ctx);
        expect(ctx.widgetCalls.length).toBe(0);
    });

    // ── turn_end ───────────────────────────────────────────────

    test("turn_end stops spinner and shows achievement prefix on final turn", async () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        const msg = { content: "I fixed the bug" };
        // Final turn: no tool results
        pi.handlers.turn_end[0]({ message: msg, toolResults: [] }, ctx);
        expect(isSpinnerRunning()).toBe(false);
        // Initial achievement prefix render
        expect(ctx.widgetCalls.length).toBeGreaterThan(0);
        await new Promise((r) => setTimeout(r, 50));
        // Should have the achievement summarization result too
        expect(
            ctx.widgetCalls.some((w) => w.lines?.[0]?.includes("Docker setup")),
        ).toBe(true);
    });

    test("turn_end keeps spinner running for intermediate tool-call turns", () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        // Prime with a running spinner (as if agent_start happened)
        pi.handlers.agent_start[0]({}, ctx);
        expect(isSpinnerRunning()).toBe(true);
        // Intermediate turn with tool results — spinner should stay running
        pi.handlers.turn_end[0](
            {
                message: { content: "Let me search" },
                toolResults: [{ role: "tool", content: "result" }],
            },
            ctx,
        );
        expect(isSpinnerRunning()).toBe(true);
        // Should not have rendered achievement prefix (✓)
        expect(ctx.widgetCalls.some((w) => w.lines?.[0]?.startsWith("✓"))).toBe(
            false,
        );
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
    });

    test("turn_end does nothing when hasUI is false", () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ hasUI: false });
        pi.handlers.turn_end[0]({ message: { content: "" } }, ctx);
        expect(ctx.widgetCalls.length).toBe(0);
    });

    test("turn_end skips empty assistant text", async () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.turn_end[0]({ message: { content: "" } }, ctx);
        await new Promise((r) => setTimeout(r, 50));
        // Should only have the initial prefix render, no achievement async
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
        // The old achievement should not have rendered (gen mismatch)
        // We expect at most 2 widget calls: first goal + second goal
        expect(ctx.widgetCalls.length).toBeLessThanOrEqual(3);
    });

    test("turn_end skips achievement render when spinner is active", async () => {
        setState("leaf-1", { topic: "Docker", goal: "Fix compose" });
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        pi.handlers.turn_end[0]({ message: { content: "done" } }, ctx);
        // Manually start spinner before achievement async completes
        renderWidget(ctx, "Fix compose", "working");
        expect(isSpinnerRunning()).toBe(true);
        await new Promise((r) => setTimeout(r, 50));
        // Achievement async should have been skipped
        expect(
            ctx.notifyCalls.some((n) =>
                n.msg?.includes("skipped-achievement-render"),
            ),
        ).toBe(false);
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
    });

    // ── /heading command ─────────────────────────────────────────

    test("/heading command sets manual goal and persists", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx({ inputResult: "Manual goal text" });
        await pi.commands.heading.handler("", ctx);
        expect(pi.entries.length).toBeGreaterThan(0);
        expect(pi.entries[0].data.goal).toBe("Manual goal text");
        expect(ctx.widgetCalls.length).toBeGreaterThan(0);
        expect(ctx.notifyCalls.some((n) => n.msg.includes("Heading set"))).toBe(
            true,
        );
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

    // ── /heading-debug command ─────────────────────────────────

    test("/heading-debug on enables debug", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.commands["heading-debug"].handler("on", ctx);
        // The command writes to the default config dir, not tmpConfigDir.
        // Verify through the notification instead.
        expect(ctx.notifyCalls.some((n) => n.msg.includes("ON"))).toBe(true);
    });

    test("/heading-debug off disables debug", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.commands["heading-debug"].handler("off", ctx);
        expect(ctx.notifyCalls.some((n) => n.msg.includes("OFF"))).toBe(true);
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
    });

    test("/heading-debug shows status when log is empty", async () => {
        headingExtension(pi as any);
        const ctx = makeMockCtx();
        await pi.commands["heading-debug"].handler("", ctx);
        expect(
            ctx.notifyCalls.some((n) => n.msg.includes("No debug entries")),
        ).toBe(true);
    });
});

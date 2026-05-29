// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
    ExtensionAPI,
    TurnEndEvent,
    TurnStartEvent,
} from "@earendil-works/pi-coding-agent";
import {
    getDebugMode,
    resolveModelId,
    setDebugMode,
    setModelOverride,
} from "./llm/picker.js";
import type { SummarizeResult } from "./llm/summarize.js";
import {
    extractTextFromMessage,
    summarize,
    summarizeAchievement,
} from "./llm/summarize.js";
import type { DebugEntry, StreamDebug } from "./state/debug.js";
import {
    clearDebugLog,
    DEBUG_LOG,
    logDebug,
    readDebugLog,
    setDebugEnabled,
} from "./state/debug.js";
import { stableTopic } from "./state/guard.js";
import {
    clearExposure,
    exposeHeading,
    getState,
    persistState,
    replayBranch,
    type State,
    setState,
} from "./state/store.js";
import {
    clearHeading,
    setHeadingMessage,
} from "./ui/widget.js";

let turnGeneration = 0;
let agentStartedForCurrentTurn = false;

function baseDebugEntry(
    prompt: string,
    modelId?: string,
): Pick<DebugEntry, "t" | "input" | "prompt" | "modelId"> {
    return {
        t: new Date().toISOString(),
        input: prompt,
        prompt: prompt.slice(0, 200),
        modelId,
    };
}

/** Extract text content from an agent message (assistant or tool result). */
function extractAgentText(msg: AgentMessage): string {
    return extractTextFromMessage(msg as AssistantMessage);
}

function makeDebugEntry(
    prompt: string,
    result: SummarizeResult,
    existing: State | undefined,
    modelId?: string,
    stableTopic?: string,
): DebugEntry {
    return {
        ...baseDebugEntry(prompt, modelId),
        fullTopicPrompt: result.fullTopicPrompt,
        fullGoalPrompt: result.fullGoalPrompt,
        topicResponse: result.topic,
        goalResponse: result.goal,
        rawTopic: "",
        rawGoal: "",
        stableTopic: stableTopic ?? existing?.topic ?? "",
        finalGoal: result.goal || (existing?.goal ?? ""),
        topicStream: result.topicDebug,
        goalStream: result.goalDebug,
        topicSystemPrompt: result.topicSystemPrompt,
        goalSystemPrompt: result.goalSystemPrompt,
    };
}

function makeDebugEntryAchievement(
    assistantText: string,
    result: {
        text: string;
        fullPrompt: string;
        systemPrompt: string;
        debug: unknown;
    },
    existing: State | undefined,
    modelId?: string,
): DebugEntry {
    return {
        ...baseDebugEntry(assistantText.slice(0, 200), modelId),
        fullTopicPrompt: "",
        fullGoalPrompt: "",
        fullAchievementPrompt: result.fullPrompt,
        topicResponse: "",
        goalResponse: "",
        achievementResponse: result.text,
        rawTopic: "",
        rawGoal: "",
        rawAchievement: "",
        stableTopic: existing?.topic ?? "",
        finalGoal: existing?.goal ?? "",
        finalAchievement: result.text,
        topicStream: undefined,
        goalStream: undefined,
        achievementStream: result.debug as StreamDebug | undefined,
        topicSystemPrompt: "",
        goalSystemPrompt: "",
        achievementSystemPrompt: result.systemPrompt,
    };
}

function makeDebugEntryError(
    prompt: string,
    existing: State | undefined,
    error: string,
    modelId?: string,
): DebugEntry {
    return {
        ...baseDebugEntry(prompt, modelId),
        fullTopicPrompt: "",
        fullGoalPrompt: "",
        topicResponse: "",
        goalResponse: "",
        rawTopic: "",
        rawGoal: "",
        stableTopic: existing?.topic ?? "",
        finalGoal: existing?.goal ?? "",
        error,
    };
}

export default function (pi: ExtensionAPI) {
    // ── Debug init ───────────────────────────────────────────────────
    const debugEnabled = getDebugMode();
    setDebugEnabled(debugEnabled);

    // ── Session lifecycle ──────────────────────────────────────────

    pi.on("session_start", async (_event, ctx) => {
        if (!ctx.hasUI) return;
        turnGeneration = 0;
        agentStartedForCurrentTurn = false;
        const replayed = replayBranch(ctx);
        if (replayed?.goal) {
            const mode = replayed.achievement ? "achievement" : "goal";
            setHeadingMessage(ctx, replayed.goal, mode);
            exposeHeading(pi, replayed, mode);
        } else {
            clearHeading(ctx);
            clearExposure(pi);
        }
    });

    // ── Agent ended — keep the working message visible ────────────

    pi.on("agent_end", (_event, ctx) => {
        if (!ctx.hasUI) return;
        agentStartedForCurrentTurn = false;
        const leafId = ctx.sessionManager.getLeafId();
        const state = leafId ? getState(leafId) : undefined;
        if (state?.goal) {
            const mode = state.achievement ? "achievement" : "goal";
            setHeadingMessage(ctx, state.goal, mode);
            exposeHeading(pi, state, mode);
        } else {
            clearHeading(ctx);
            clearExposure(pi);
        }
        ctx.ui.setWorkingVisible(true); // ensure working indicator stays visible
    });

    pi.on("session_shutdown", async (_event, ctx) => {
        if (!ctx.hasUI) return;
        clearHeading(ctx);
        ctx.ui.setWorkingVisible(true); // restore default for next session
        clearExposure(pi);
    });

    // ── Summarize on every user message ────────────────────────────

    pi.on("before_agent_start", (event, ctx) => {
        const prompt = event.prompt?.trim();
        if (!prompt || !ctx.hasUI) return;

        const myGeneration = ++turnGeneration;
        agentStartedForCurrentTurn = false;

        const leafId = ctx.sessionManager.getLeafId();

        // Fire-and-forget: do not await summarize — we must not block the agent
        void (async () => {
            try {
                const result = await summarize(ctx, prompt);
                if (myGeneration !== turnGeneration) return; // stale turn

                const existing = leafId ? getState(leafId) : undefined;

                if (!result.goal.trim()) {
                    logDebug(
                        makeDebugEntry(prompt, result, existing, ctx.model?.id),
                    );
                    return;
                }

                const stable = stableTopic(existing?.topic, result.topic);
                const state: State = {
                    topic: stable,
                    goal: result.goal,
                    achievement: existing?.achievement,
                };

                if (leafId) {
                    setState(leafId, state);
                    if (
                        existing?.topic !== state.topic ||
                        existing?.goal !== state.goal ||
                        existing?.achievement !== state.achievement
                    ) {
                        persistState(pi, state);
                    }
                }

                const mode = agentStartedForCurrentTurn ? "working" : "goal";
                setHeadingMessage(ctx, result.goal, mode);
                exposeHeading(pi, state, mode);
                logDebug(
                    makeDebugEntry(
                        prompt,
                        result,
                        existing,
                        ctx.model?.id,
                        stable,
                    ),
                );
            } catch (err) {
                if (myGeneration !== turnGeneration) return; // stale turn
                const msg = (err as Error).message ?? String(err);
                ctx.ui.notify(`[pi-heading] Summarize failed: ${msg}`, "error");
                const existing = leafId ? getState(leafId) : undefined;
                logDebug(
                    makeDebugEntryError(prompt, existing, msg, ctx.model?.id),
                );
            }
        })();
    });

    // ── Agent started — set working message text ──────────────────

    pi.on("agent_start", (_event, ctx) => {
        if (!ctx.hasUI) return;
        agentStartedForCurrentTurn = true;

        const leafId = ctx.sessionManager.getLeafId();
        const state = leafId ? getState(leafId) : undefined;
        if (state?.goal) {
            setHeadingMessage(ctx, state.goal, "working");
            exposeHeading(pi, state, "working");
        }
    });

    // ── Turn started — refresh working message between tool-call turns ─

    pi.on("turn_start", (_event: TurnStartEvent, ctx) => {
        if (!ctx.hasUI) return;
        const leafId = ctx.sessionManager.getLeafId();
        const state = leafId ? getState(leafId) : undefined;
        if (state?.goal) {
            setHeadingMessage(ctx, state.goal, "working");
            exposeHeading(pi, state, "working");
        }
    });

    // ── Achievement summary on every turn end ─────────────────────

    pi.on("turn_end", (event: TurnEndEvent, ctx) => {
        if (!ctx.hasUI) return;

        const leafId = ctx.sessionManager.getLeafId();
        const existing = leafId ? getState(leafId) : undefined;

        const hasToolResults =
            event.toolResults && event.toolResults.length > 0;

        const assistantText = extractAgentText(event.message);

        if (hasToolResults) {
            if (assistantText.trim()) {
                logDebug(
                    makeDebugEntryError(
                        assistantText.slice(0, 200),
                        existing,
                        "skipped-achievement: intermediate tool turn",
                        ctx.model?.id,
                    ),
                );
            }
            return;
        }

        if (!assistantText.trim()) return;

        const myGeneration = turnGeneration;

        // Fire-and-forget: do not block the next turn
        void (async () => {
            try {
                const achResult = await summarizeAchievement(
                    ctx,
                    assistantText,
                    existing?.goal,
                );
                const achievement = achResult.text.trim();
                if (!achievement) {
                    logDebug(
                        makeDebugEntryAchievement(
                            assistantText,
                            achResult,
                            existing,
                            ctx.model?.id,
                        ),
                    );
                    return;
                }

                if (myGeneration !== turnGeneration) return; // stale turn

                // Re-read fresh state in case the before_agent_start summarization
                // already updated the goal for the next turn while we were async.
                const fresh = leafId ? getState(leafId) : undefined;

                const state: State = {
                    topic: fresh?.topic ?? existing?.topic ?? "",
                    goal: fresh?.goal ?? existing?.goal ?? "",
                    achievement,
                };

                if (leafId) {
                    setState(leafId, state);
                    // Persist if anything changed vs the fresh (or captured) state
                    const prior = fresh ?? existing;
                    if (
                        prior?.topic !== state.topic ||
                        prior?.goal !== state.goal ||
                        prior?.achievement !== state.achievement
                    ) {
                        persistState(pi, state);
                    }
                }
                await pi.sendMessage(
                    {
                        customType: "heading-achievement",
                        content: `✓ ${achievement}`,
                        display: true,
                    },
                    { triggerTurn: false },
                );
                exposeHeading(pi, state, "achievement");
                logDebug(
                    makeDebugEntryAchievement(
                        assistantText,
                        achResult,
                        existing,
                        ctx.model?.id,
                    ),
                );
            } catch (err) {
                if (myGeneration !== turnGeneration) return; // stale turn
                // Achievement summarization failure is non-fatal — keep showing the goal
                const msg = (err as Error).message ?? String(err);
                ctx.ui.notify(
                    `[pi-heading] Achievement summarize failed: ${msg}`,
                    "error",
                );
                logDebug(
                    makeDebugEntryError(
                        assistantText.slice(0, 200),
                        existing,
                        msg,
                        ctx.model?.id,
                    ),
                );
            }
        })();
    });

    // ── Slash command: /heading ────────────────────────────────────

    pi.registerCommand("heading", {
        description: "Manually set the session heading",
        handler: async (_args, ctx) => {
            if (!ctx.hasUI) return;
            const input = await ctx.ui.input("Session heading");
            if (!input?.trim()) return;

            const goal = input.trim();
            const leafId = ctx.sessionManager.getLeafId();
            const existing = leafId ? getState(leafId) : undefined;
            const state: State = {
                topic: existing?.topic ?? "manual",
                goal,
                achievement: existing?.achievement,
            };

            if (leafId) {
                setState(leafId, state);
                persistState(pi, state);
            }
            setHeadingMessage(ctx, goal);
            exposeHeading(pi, state, "goal");
            ctx.ui.notify(`Heading set: ${goal}`, "info");
        },
    });

    // ── Slash command: /heading-model ──────────────────────────────

    pi.registerCommand("heading-model", {
        description: "Change the model used for heading summarization",
        handler: async (_args, ctx) => {
            if (!ctx.hasUI) return;

            const registry = ctx.modelRegistry;
            const available = registry.getAvailable();
            if (!available.length) {
                ctx.ui.notify(
                    "[pi-heading] No models available in registry",
                    "error",
                );
                return;
            }

            const current = resolveModelId(ctx);

            const choices = [
                "↺ Reset to session model",
                ...available.map((m) => {
                    const marker = m.id === current ? "● " : "  ";
                    const provider = m.provider ? ` (${m.provider})` : "";
                    return `${marker}${m.id}${provider}`;
                }),
            ];

            const selectedLine = await ctx.ui.select(
                "Select heading model",
                choices,
            );
            if (!selectedLine) return;

            if (selectedLine === "↺ Reset to session model") {
                setModelOverride(undefined);
                ctx.ui.notify(
                    `[pi-heading] Heading model reset — using session model (${ctx.model?.id ?? "none"})`,
                    "info",
                );
                return;
            }

            const selected = selectedLine
                .replace(/^\s*[●]?\s*/, "")
                .split(" (")[0];
            const model = available.find((m) => m.id === selected);
            if (!model) {
                ctx.ui.notify(
                    `[pi-heading] Model ${selected} not found`,
                    "error",
                );
                return;
            }

            const auth = await registry.getApiKeyAndHeaders(model);
            if (!auth.ok || !auth.apiKey) {
                ctx.ui.notify(
                    `[pi-heading] Model ${selected} has no API key configured`,
                    "warning",
                );
            }

            setModelOverride(selected);
            ctx.ui.notify(
                `[pi-heading] Heading model set to ${selected}`,
                "info",
            );
        },
    });

    // ── Slash command: /heading-debug ───────────────────────────────

    pi.registerCommand("heading-debug", {
        description: "Toggle or show pi-heading debug info",
        handler: async (args, ctx) => {
            const arg = args?.trim().toLowerCase();

            if (arg === "on") {
                setDebugMode(true);
                setDebugEnabled(true);
                ctx.ui.notify(
                    `[pi-heading] Debug mode ON — logging to ${DEBUG_LOG}`,
                    "info",
                );
                return;
            }
            if (arg === "off") {
                setDebugMode(false);
                setDebugEnabled(false);
                ctx.ui.notify("[pi-heading] Debug mode OFF", "info");
                return;
            }
            if (arg === "clear") {
                clearDebugLog();
                ctx.ui.notify("[pi-heading] Debug log cleared", "info");
                return;
            }

            // Default: show last entries
            const entries = readDebugLog(10);
            if (entries.length === 0) {
                ctx.ui.notify(
                    `[pi-heading] No debug entries. Debug is ${debugEnabled ? "ON" : "OFF"}. Use "/heading-debug on" to enable.`,
                    "info",
                );
                return;
            }

            const lines = entries.map((e) => {
                const ts = e.t.split("T")[1]?.slice(0, 8) ?? e.t;
                const err = e.error ? ` ❌ ${e.error.slice(0, 60)}` : "";
                const rawGoal = e.goalResponse || e.rawGoal || "";
                let streamInfo = "";
                if (e.goalStream?.extractedText) {
                    streamInfo = ` 📡${e.goalStream.extractedText.length}c`;
                } else if (e.goalStream?.errorEvent) {
                    streamInfo = ` 💥${e.goalStream.errorEvent.slice(0, 20)}`;
                }
                const frontmatterLeak = e.goalSystemPrompt?.includes(
                    "max_words:",
                )
                    ? " ⚠️FRONTMATTER_LEAK"
                    : "";
                const ach = e.achievementResponse
                    ? ` ✓:"${e.achievementResponse.slice(0, 30)}"`
                    : "";
                return `${ts} ▸ goal:"${rawGoal.slice(0, 40)}" final:"${e.finalGoal.slice(0, 40)}"${ach}${streamInfo}${err}${frontmatterLeak}`;
            });

            ctx.ui.notify(
                [
                    `[pi-heading] Last ${entries.length} entries (debug=${debugEnabled ? "ON" : "OFF"}):`,
                    ...lines,
                ].join("\n"),
                "info",
            );
        },
    });
}

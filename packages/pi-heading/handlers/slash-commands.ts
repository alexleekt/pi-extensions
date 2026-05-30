// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type {
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { resolveModelId, setModelOverride } from "../llm/picker.js";
import {
    clearDebugLog,
    DEBUG_LOG,
    getDebugMode,
    readDebugLog,
    setDebugEnabled,
    setDebugMode,
} from "../state/debug.js";
import {
    exposeHeading,
    getState,
    persistState,
    setState,
} from "../state/store.js";
import { setHeadingMessage } from "../ui/indicator.js";

export async function handleHeading(
    _args: string,
    ctx: ExtensionContext,
    pi: ExtensionAPI,
): Promise<void> {
    if (!ctx.hasUI) return;
    const input = await ctx.ui.input("Session heading");
    if (!input?.trim()) return;

    const goal = input.trim();
    const leafId = ctx.sessionManager.getLeafId();
    const existing = leafId ? getState(leafId) : undefined;
    const state = {
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
}

export async function handleHeadingModel(
    _args: string,
    ctx: ExtensionContext,
    _pi: ExtensionAPI,
): Promise<void> {
    if (!ctx.hasUI) return;

    const registry = ctx.modelRegistry;
    const available = registry.getAvailable();
    if (!available.length) {
        ctx.ui.notify("[pi-heading] No models available in registry", "error");
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

    const selectedLine = await ctx.ui.select("Select heading model", choices);
    if (!selectedLine) return;

    if (selectedLine === "↺ Reset to session model") {
        setModelOverride(undefined);
        ctx.ui.notify(
            `[pi-heading] Heading model reset — using session model (${ctx.model?.id ?? "none"})`,
            "info",
        );
        return;
    }

    const selected = selectedLine.replace(/^\s*[●]?\s*/, "").split(" (")[0];
    const model = available.find((m) => m.id === selected);
    if (!model) {
        ctx.ui.notify(`[pi-heading] Model ${selected} not found`, "error");
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
    ctx.ui.notify(`[pi-heading] Heading model set to ${selected}`, "info");
}

export async function handleHeadingDebug(
    args: string,
    ctx: ExtensionContext,
    _pi: ExtensionAPI,
): Promise<void> {
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
        const debugEnabled = getDebugMode();
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
        const frontmatterLeak = e.goalSystemPrompt?.includes("max_words:")
            ? " ⚠️FRONTMATTER_LEAK"
            : "";
        const ach = e.achievementResponse
            ? ` ✓:"${e.achievementResponse.slice(0, 30)}"`
            : "";
        return `${ts} ▸ goal:"${rawGoal.slice(0, 40)}" final:"${e.finalGoal.slice(0, 40)}"${ach}${streamInfo}${err}${frontmatterLeak}`;
    });

    const debugEnabled = getDebugMode();
    ctx.ui.notify(
        [
            `[pi-heading] Last ${entries.length} entries (debug=${debugEnabled ? "ON" : "OFF"}):`,
            ...lines,
        ].join("\n"),
        "info",
    );
}

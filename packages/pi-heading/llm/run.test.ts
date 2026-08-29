// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { setModelOverride } from "./picker.js";

let calls: unknown[][] = [];
let responses: Array<AssistantMessage | Error> = [];

function message(text: string, stopReason: AssistantMessage["stopReason"] = "stop", errorMessage?: string): AssistantMessage {
    return {
        role: "assistant",
        content: text ? [{ type: "text", text }] : [],
        api: "test",
        provider: "test",
        model: "test-model",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason,
        errorMessage,
        timestamp: Date.now(),
    } as AssistantMessage;
}

const mockCompleteSimple = mock((...args: unknown[]) => {
    calls.push(args);
    const response = responses.shift() ?? message('{"result":"ok"}');
    if (response instanceof Error) throw response;
    return Promise.resolve(response);
});

beforeAll(() => {
    mock.module("@earendil-works/pi-ai/compat", () => ({
        completeSimple: (...args: unknown[]) => mockCompleteSimple(...args),
    }));
});

beforeEach(() => {
    calls = [];
    responses = [];
    setModelOverride(undefined);
});

function ctxFor(models: Record<string, unknown>[], signal = new AbortController().signal) {
    return {
        signal,
        model: models[0],
        scopedModels: models.map((model) => ({ model })),
        modelRegistry: {
            getAvailable: () => models,
            isUsingOAuth: () => false,
            getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "fake-key", headers: {} }),
        },
    } as any;
}

const models = (count = 2) => Array.from({ length: count }, (_, index) => ({
    provider: "test",
    id: `model-${index}`,
    api: "openai-completions",
    cost: { input: index, output: 0 },
    maxTokens: 800,
}));

function payloadFor(options: Record<string, unknown>): Record<string, unknown> {
    return (options.onPayload as (p: unknown) => Record<string, unknown>)({ existing: true });
}

describe("runPrompt", () => {
    let runPrompt: typeof import("./run.js").runPrompt;

    beforeAll(async () => {
        runPrompt = (await import("./run.js")).runPrompt;
    });

    test("keeps response_format behavior and clamps maxTokens", async () => {
        await runPrompt(ctxFor(models(1)), "goal", "do the thing");
        const opts = calls[0][2] as Record<string, unknown>;
        expect(opts.temperature).toBe(0);
        expect(opts.maxTokens).toBe(512);
        expect(payloadFor(opts)).toEqual({ existing: true, response_format: { type: "json_object" } });
    });

    test("hard failure falls back and next succeeds", async () => {
        responses = [new Error("overloaded"), message('{"result":"done"}')];
        expect((await runPrompt(ctxFor(models()), "goal", "x")).text).toBe("done");
        expect(calls).toHaveLength(2);
    });

    test("empty falls back and next succeeds", async () => {
        responses = [message(""), message('{"result":"done"}')];
        expect((await runPrompt(ctxFor(models()), "goal", "x")).text).toBe("done");
    });

    test("all empty returns an empty result", async () => {
        responses = [message(""), message("")];
        expect((await runPrompt(ctxFor(models()), "goal", "x")).text).toBe("");
    });

    test("hard failure followed by empty throws the hard failure", async () => {
        responses = [new Error("overloaded"), message("")];
        await expect(runPrompt(ctxFor(models()), "goal", "x")).rejects.toThrow("overloaded");
    });

    test("auth failure falls back", async () => {
        const candidates = models();
        const ctx = ctxFor(candidates);
        ctx.modelRegistry.getApiKeyAndHeaders = async (model: { id: string }) =>
            model.id === "model-0" ? { ok: false } : { ok: true, apiKey: "key", headers: {} };
        expect((await runPrompt(ctx, "goal", "x")).text).toBe("ok");
        expect(calls).toHaveLength(1);
    });

    test("abort stops fallback attempts", async () => {
        responses = [message("", "aborted"), message('{"result":"wrong"}')];
        await expect(runPrompt(ctxFor(models()), "goal", "x")).rejects.toMatchObject({ name: "AbortError" });
        expect(calls).toHaveLength(1);
    });

    test("error AssistantMessage is a hard failure", async () => {
        responses = [message("", "error", "provider failed"), message('{"result":"ok"}')];
        expect((await runPrompt(ctxFor(models()), "goal", "x")).text).toBe("ok");
        expect(calls).toHaveLength(2);
    });

    test("reasoning low is passed only when native off is null", async () => {
        const reasoning = { ...models(1)[0], reasoning: true, thinkingLevelMap: { off: null } };
        await runPrompt(ctxFor([reasoning]), "goal", "x");
        expect((calls[0][2] as any).reasoning).toBe("low");

        calls = [];
        const nativeOff = { ...reasoning, thinkingLevelMap: { off: "none" } };
        await runPrompt(ctxFor([nativeOff]), "goal", "x");
        expect((calls[0][2] as any).reasoning).toBeUndefined();
    });

    test("caps fallback attempts at three", async () => {
        responses = [new Error("1"), new Error("2"), new Error("3"), message('{"result":"wrong"}')];
        await expect(runPrompt(ctxFor(models(4)), "goal", "x")).rejects.toThrow("3");
        expect(calls).toHaveLength(3);
    });
});

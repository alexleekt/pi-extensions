// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { beforeAll, describe, expect, mock, test } from "bun:test";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { setModelOverride } from "./picker.js";

// Capture the options object completeSimple is called with so we can assert
// which provider-specific request params runPrompt sends.
let lastOptions: Record<string, unknown> | undefined;

const mockCompleteSimple = mock((..._args: unknown[]) => {
    lastOptions = _args[2] as Record<string, unknown>;
    return Promise.resolve({
        role: "assistant",
        content: [{ type: "text", text: '{"result": "ok"}' }],
        api: "test",
        provider: "test",
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
    } as AssistantMessage);
});

beforeAll(() => {
    mock.module("@earendil-works/pi-ai", () => ({
        completeSimple: (...args: unknown[]) => mockCompleteSimple(...args),
    }));
    setModelOverride(undefined);
});

function ctxFor(api: string) {
    return {
        model: { id: "test-model" },
        modelRegistry: {
            getAvailable: () => [{ id: "test-model", api }],
            getApiKeyAndHeaders: async () => ({
                ok: true,
                apiKey: "fake-key",
                headers: {},
            }),
        },
    } as unknown;
}

// Resolve the onPayload result the same way completeSimple would.
function payloadFor(options: Record<string, unknown>): Record<string, unknown> {
    const onPayload = options.onPayload as (
        p: unknown,
    ) => Record<string, unknown>;
    return onPayload({ existing: true });
}

describe("runPrompt provider-specific request params", () => {
    let runPrompt: typeof import("./run.js").runPrompt;

    beforeAll(async () => {
        runPrompt = (await import("./run.js")).runPrompt;
    });

    test("openai-completions: sends response_format and temperature", async () => {
        await runPrompt(ctxFor("openai-completions"), "goal", "do the thing");
        const opts = lastOptions ?? {};
        expect(opts.temperature).toBe(0);
        const payload = payloadFor(opts);
        expect(payload.response_format).toEqual({ type: "json_object" });
        // onPayload must preserve the incoming payload
        expect(payload.existing).toBe(true);
    });

    test("anthropic-messages: no response_format, keeps temperature", async () => {
        await runPrompt(ctxFor("anthropic-messages"), "goal", "do the thing");
        const opts = lastOptions ?? {};
        expect(opts.temperature).toBe(0);
        const payload = payloadFor(opts);
        expect(payload.response_format).toBeUndefined();
    });

    test("openai-responses: no response_format, no temperature", async () => {
        await runPrompt(ctxFor("openai-responses"), "goal", "do the thing");
        const opts = lastOptions ?? {};
        expect(opts.temperature).toBeUndefined();
        const payload = payloadFor(opts);
        expect(payload.response_format).toBeUndefined();
    });
});

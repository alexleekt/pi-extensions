// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { beforeAll, describe, expect, mock, test } from "bun:test";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { SummarizeResult } from "./summarize.js";

const mockCompleteSimple = mock(() =>
    Promise.resolve({
        role: "assistant",
        content: [{ type: "text", text: "" }],
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
    } as AssistantMessage),
);

beforeAll(() => {
    mock.module("@earendil-works/pi-ai", () => ({
        completeSimple: (...args: unknown[]) => mockCompleteSimple(...args),
    }));
});

const mockCtx = {
    model: { id: "test-model" },
    modelRegistry: {
        getAvailable: () => [{ id: "test-model", api: "openai" }],
        getApiKeyAndHeaders: async () => ({
            ok: true,
            apiKey: "fake-key",
            headers: {},
        }),
    },
} as {
    model: { id: string };
    modelRegistry: {
        getAvailable: () => { id: string; api: string }[];
        getApiKeyAndHeaders: () => Promise<{
            ok: boolean;
            apiKey: string;
            headers: Record<string, string>;
        }>;
    };
};

describe("summarize pipeline", () => {
    let summarize: (ctx: unknown, message: string) => Promise<SummarizeResult>;

    beforeAll(async () => {
        const mod = await import("./summarize.js");
        summarize = mod.summarize;
    });

    test("returns topic and goal from final message text", async () => {
        let callIdx = 0;
        mockCompleteSimple.mockImplementation(() => {
            callIdx++;
            return Promise.resolve({
                role: "assistant",
                content: [
                    {
                        type: "text",
                        text: callIdx === 1 ? "Docker" : "Fix compose",
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
            });
        });

        const result = await summarize(mockCtx, "How do I fix docker compose?");

        expect(result.topic).toBe("Docker");
        expect(result.goal).toBe("Fix compose");
        expect(result.fullTopicPrompt).toContain(
            "Message: How do I fix docker compose?",
        );
        expect(result.fullGoalPrompt).toContain(
            "Message: How do I fix docker compose?",
        );
    });

    test("truncates topic and goal to max words", async () => {
        let callIdx = 0;
        mockCompleteSimple.mockImplementation(() => {
            callIdx++;
            return Promise.resolve({
                role: "assistant",
                content: [
                    {
                        type: "text",
                        text:
                            callIdx === 1
                                ? "Docker container orchestration setup guide"
                                : "Fix the docker compose networking issue in production environment today immediately right now please",
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
            });
        });

        const result = await summarize(
            mockCtx,
            "How do I fix docker compose networking in production?",
        );

        expect(result.topic).toBe("Docker container orchestration setup…"); // 4 words max
        expect(result.goal).toBe(
            "Fix the docker compose networking issue in production environment today immediately right…",
        ); // 12 words max
    });

    test("extracts text from done.message content", async () => {
        let callIdx = 0;
        mockCompleteSimple.mockImplementation(() => {
            callIdx++;
            return Promise.resolve({
                role: "assistant",
                content: [
                    {
                        type: "text",
                        text:
                            callIdx === 1 ? "Kubernetes" : "Deploy the service",
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
            });
        });

        const result = await summarize(mockCtx, "Deploy to Kubernetes");

        expect(result.topic).toBe("Kubernetes");
        expect(result.goal).toBe("Deploy the service");
    });

    test("throws on provider error", async () => {
        mockCompleteSimple.mockImplementation(() => {
            throw new Error("model overloaded");
        });

        await expect(summarize(mockCtx, "test")).rejects.toThrow(
            "model overloaded",
        );
    });

    test("topic prompt contains topic instructions", async () => {
        let callIdx = 0;
        mockCompleteSimple.mockImplementation(() => {
            callIdx++;
            return Promise.resolve({
                role: "assistant",
                content: [
                    {
                        type: "text",
                        text:
                            callIdx === 1
                                ? "General"
                                : "Establish the session goal.",
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
            });
        });

        const result = await summarize(mockCtx, "hi there");

        expect(result.fullTopicPrompt).toContain("topic tagger");
        expect(result.fullTopicPrompt).toContain("hi there");
        expect(result.fullGoalPrompt).toContain("session objective summarizer");
        expect(result.fullGoalPrompt).toContain("hi there");
    });

    test("parallel calls use same message but different systemPrompts", async () => {
        const contexts: unknown[] = [];
        mockCompleteSimple.mockImplementation(
            (_model: unknown, context: unknown) => {
                contexts.push(context);
                return Promise.resolve({
                    role: "assistant",
                    content: [{ type: "text", text: "test" }],
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
                });
            },
        );

        await summarize(mockCtx, "Shared message");

        expect(contexts.length).toBe(2);
        expect(contexts[0].systemPrompt).toContain("topic tagger");
        expect(contexts[1].systemPrompt).toContain(
            "session objective summarizer",
        );
        expect(contexts[0].messages[0].content[0].text).toContain(
            "Shared message",
        );
        expect(contexts[1].messages[0].content[0].text).toContain(
            "Shared message",
        );
        expect(contexts[0].systemPrompt).not.toBe(contexts[1].systemPrompt);
    });

    test("extracts clean text from JSON-wrapped model response", async () => {
        mockCompleteSimple.mockImplementation(() => {
            return Promise.resolve({
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
            });
        });

        const result = await summarize(mockCtx, "How do I fix docker compose?");

        expect(result.topic).toBe("Docker setup");
        expect(result.goal).toBe("Docker setup");
    });

    test("extracts text from JSON with trailing commentary", async () => {
        mockCompleteSimple.mockImplementation(() => {
            return Promise.resolve({
                role: "assistant",
                content: [
                    {
                        type: "text",
                        text: '{"result": "Docker setup"} That should do it',
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
            });
        });

        const result = await summarize(mockCtx, "How do I fix docker compose?");

        expect(result.topic).toBe("Docker setup");
        expect(result.goal).toBe("Docker setup");
    });

    test("ignores thinking content and uses only text parts", async () => {
        mockCompleteSimple.mockImplementation(() => {
            return Promise.resolve({
                role: "assistant",
                content: [
                    {
                        type: "thinking",
                        thinking:
                            "Let me analyze this: the user wants Docker help",
                    },
                    { type: "text", text: "Kubernetes" },
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
            });
        });

        const result = await summarize(mockCtx, "Deploy to Kubernetes");

        expect(result.topic).toBe("Kubernetes");
        expect(result.goal).toBe("Kubernetes");
    });

    test("handles non-string result value by coercing to string", async () => {
        mockCompleteSimple.mockImplementation(() => {
            return Promise.resolve({
                role: "assistant",
                content: [{ type: "text", text: '{"result": 42}' }],
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
            });
        });

        const result = await summarize(mockCtx, "test");

        expect(result.topic).toBe("42");
        expect(result.goal).toBe("42");
    });

    test("strips quotes that survive prefix removal in full pipeline", async () => {
        let callIdx = 0;
        mockCompleteSimple.mockImplementation(() => {
            callIdx++;
            return Promise.resolve({
                role: "assistant",
                content: [
                    {
                        type: "text",
                        text:
                            callIdx === 1
                                ? 'The user wants to "Docker setup"'
                                : 'The user wants to "Fix compose"',
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
            });
        });

        const result = await summarize(mockCtx, "How do I fix docker compose?");

        expect(result.topic).toBe("Docker setup");
        expect(result.goal).toBe("Fix compose");
    });

    test("handles malformed JSON missing closing brace via regex fallback", async () => {
        let callIdx = 0;
        mockCompleteSimple.mockImplementation(() => {
            callIdx++;
            return Promise.resolve({
                role: "assistant",
                content: [
                    {
                        type: "text",
                        text:
                            callIdx === 1
                                ? '{"result": "Docker setup"'
                                : '{"result": "Fix compose"',
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
            });
        });

        const result = await summarize(mockCtx, "How do I fix docker compose?");

        expect(result.topic).toBe("Docker setup");
        expect(result.goal).toBe("Fix compose");
    });
});

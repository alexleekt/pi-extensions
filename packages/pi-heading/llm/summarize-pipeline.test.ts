// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { describe, expect, test, mock, beforeAll } from "bun:test";
import type { SummarizeResult } from "./summarize.js";

const mockCompleteSimple = mock(() => Promise.resolve({
  role: "assistant",
  content: [{ type: "text", text: "" }],
  api: "openai-completions",
  provider: "openai",
  model: "test-model",
  usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
  stopReason: "stop",
  timestamp: Date.now(),
} as any));

beforeAll(() => {
  mock.module("@earendil-works/pi-ai", () => ({
    completeSimple: (...args: any[]) => mockCompleteSimple(...args),
  }));
});

const mockCtx = {
  model: { id: "test-model" },
  modelRegistry: {
    getAvailable: () => [{ id: "test-model", api: "openai" }],
    getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "fake-key", headers: {} }),
  },
} as any;

describe("summarize pipeline", () => {
  let summarize: (ctx: any, message: string) => Promise<SummarizeResult>;

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
        content: [{ type: "text", text: callIdx === 1 ? "Docker" : "Fix compose" }],
        api: "openai-completions",
        provider: "openai",
        model: "test-model",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: "stop",
        timestamp: Date.now(),
      });
    });

    const result = await summarize(mockCtx, "How do I fix docker compose?");

    expect(result.topic).toBe("Docker");
    expect(result.goal).toBe("Fix compose");
    expect(result.fullTopicPrompt).toContain("Message: How do I fix docker compose?");
    expect(result.fullGoalPrompt).toContain("Message: How do I fix docker compose?");
  });

  test("truncates topic and goal to max words", async () => {
    let callIdx = 0;
    mockCompleteSimple.mockImplementation(() => {
      callIdx++;
      return Promise.resolve({
        role: "assistant",
        content: [{ type: "text", text: callIdx === 1 ? "Docker container orchestration setup guide" : "Fix the docker compose networking issue in production environment today immediately right now please" }],
        api: "openai-completions",
        provider: "openai",
        model: "test-model",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: "stop",
        timestamp: Date.now(),
      });
    });

    const result = await summarize(mockCtx, "How do I fix docker compose networking in production?");

    expect(result.topic).toBe("Docker container orchestration setup…"); // 4 words max
    expect(result.goal).toBe("Fix the docker compose networking issue in production environment today immediately right…"); // 12 words max
  });

  test("extracts text from done.message content", async () => {
    let callIdx = 0;
    mockCompleteSimple.mockImplementation(() => {
      callIdx++;
      return Promise.resolve({
        role: "assistant",
        content: [{ type: "text", text: callIdx === 1 ? "Kubernetes" : "Deploy the service" }],
        api: "openai-completions",
        provider: "openai",
        model: "test-model",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
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

    await expect(summarize(mockCtx, "test")).rejects.toThrow("model overloaded");
  });

  test("topic prompt contains topic instructions", async () => {
    let callIdx = 0;
    mockCompleteSimple.mockImplementation(() => {
      callIdx++;
      return Promise.resolve({
        role: "assistant",
        content: [{ type: "text", text: callIdx === 1 ? "General" : "Establish the session goal." }],
        api: "openai-completions",
        provider: "openai",
        model: "test-model",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
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
    const contexts: any[] = [];
    mockCompleteSimple.mockImplementation((_model: any, context: any) => {
      contexts.push(context);
      return Promise.resolve({
        role: "assistant",
        content: [{ type: "text", text: "test" }],
        api: "openai-completions",
        provider: "openai",
        model: "test-model",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: "stop",
        timestamp: Date.now(),
      });
    });

    await summarize(mockCtx, "Shared message");

    expect(contexts.length).toBe(2);
    expect(contexts[0].systemPrompt).toContain("topic tagger");
    expect(contexts[1].systemPrompt).toContain("session objective summarizer");
    expect(contexts[0].messages[0].content[0].text).toContain("Shared message");
    expect(contexts[1].messages[0].content[0].text).toContain("Shared message");
    expect(contexts[0].systemPrompt).not.toBe(contexts[1].systemPrompt);
  });
});

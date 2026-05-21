// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Api, AssistantMessage, Message, Model } from "@earendil-works/pi-ai";
import { completeSimple } from "@earendil-works/pi-ai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { resolveModelId } from "./picker.js";
import type { StreamDebug } from "../state/debug.js";

interface PromptFile {
  maxWords: number;
  /** Instructions, examples, and rules — these go into the user message, not the system prompt. */
  instructions: string;
  /** Template for the user message placeholder (usually "{message}"). */
  template: string;
}

const PROMPT_DIR = path.join(os.homedir(), ".pi", "agent", "extensions", "pi-heading", "prompts");
const DEFAULT_PROMPT_DIR = path.join(import.meta.dirname ?? ".", "..", "prompts");

function readFileOrFallback(paths: string[], fallback: string): string {
  for (const p of paths) {
    try {
      return fs.readFileSync(p, "utf8");
    } catch {
      // try next
    }
  }
  return fallback;
}

export function readPromptFile(
  name: string,
  userDir: string = PROMPT_DIR,
  defaultDir: string = DEFAULT_PROMPT_DIR,
): PromptFile {
  const raw = readFileOrFallback(
    [path.join(userDir, `${name}.md`), path.join(defaultDir, `${name}.md`)],
    "---\nmax_words: 10\n---\nSummarize the user's message concisely.\n\nMessage: {message}",
  );

  const match = raw.match(/^---\s*\n([\s\S]*?)---\s*(?:\n|$)([\s\S]*)$/);
  let maxWords = 10;
  let template = raw;

  if (match) {
    template = match[2].trim();
    const wordsMatch = match[1].match(/max_words:\s*(\d+)/);
    if (wordsMatch) maxWords = parseInt(wordsMatch[1], 10);
  }

  // Split instructions from message placeholder.
  // Prompts end with "Message: {message}" — everything before is instructions,
  // everything after is the template (usually just "{message}").
  const msgMarker = "Message: ";
  const msgIdx = template.lastIndexOf(msgMarker + "{message}");
  if (msgIdx >= 0) {
    return {
      maxWords,
      instructions: template.slice(0, msgIdx).trim(),
      template: template.slice(msgIdx + msgMarker.length).trim(),
    };
  }

  // Fallback: no Message: prefix — treat entire template as instructions, message template is raw input
  return { maxWords, instructions: template, template: "{message}" };
}

export function truncateToWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ") + "…";
}

function thinkingOffOpts(model: Model<Api>): Record<string, unknown> {
  switch (model.api) {
    case "anthropic-messages":
      return { thinkingEnabled: false };
    case "google-generative-ai":
    case "google-vertex":
      return { thinking: { enabled: false } };
    default:
      return {};
  }
}

export interface RunPromptResult {
  text: string;
  fullPrompt: string;
  systemPrompt: string;
  debug: StreamDebug;
}

function buildSystemPrompt(instructions: string, maxWords: number, example: string): string {
  return `${instructions}\n\nSTRICT FORMAT RULES:\n- You MUST respond with a valid JSON object containing a single key "result".\n- The value of "result" must be ${maxWords} words or fewer.\n- NO quotes, NO markdown, NO explanation, NO word count, NO meta-commentary inside the JSON.\n- Example: {"result": "${example}"}`;
}

async function runPrompt(
  ctx: ExtensionContext,
  fileName: string,
  message: string,
  goal?: string,
): Promise<RunPromptResult> {
  const promptFile = readPromptFile(fileName);
  let userText = promptFile.template.replace(/\{message\}/g, message);
  if (goal !== undefined) {
    userText = userText.replace(/\{goal\}/g, goal);
  }
  const example =
    fileName === "topic" ? "Rust memory leak" :
    fileName === "achievement" ? "Fixed JWT middleware in 3 files" :
    "Fix the memory leak in the Rust service.";
  const systemPrompt = buildSystemPrompt(promptFile.instructions, promptFile.maxWords, example);
  const fullPrompt = `${systemPrompt}\n\nMessage: ${userText}`;

  const modelId = resolveModelId(ctx);
  if (!modelId) throw new Error("No model available for heading summarization");

  const registry = ctx.modelRegistry;
  const model = registry.getAvailable().find((m) => m.id === modelId);
  if (!model) throw new Error(`Model ${modelId} not found in registry`);

  const auth = await registry.getApiKeyAndHeaders(model);
  if (!auth.ok || !auth.apiKey) throw new Error(`No API key available for model ${modelId}`);

  const result = await completeSimple(
    model,
    { systemPrompt, messages: [{ role: "user", content: [{ type: "text", text: userText }], timestamp: Date.now() }] },
    {
      apiKey: auth.apiKey,
      headers: auth.headers || {},
      maxTokens: Math.min(128, promptFile.maxWords * 2 + 8),
      temperature: 0,
      ...thinkingOffOpts(model),
      onPayload: (payload: any) => { payload.response_format = { type: "json_object" }; return payload; },
    },
  );

  const extracted = extractTextFromMessage(result);
  const cleaned = cleanLLMOutput(extracted);
  // Some models wrap JSON in markdown fences even with response_format: json_object.
  // extractTextFromMessage parses JSON on the raw text; if that failed because of
  // fences, try again after cleanLLMOutput has stripped them.
  const finalText = tryParseJsonResult(cleaned) ?? cleaned;
  return {
    text: truncateToWords(finalText, promptFile.maxWords),
    fullPrompt,
    systemPrompt,
    debug: { extractedText: finalText, finalMessageText: extracted },
  };
}

function extractTextFromMessage(msg: AssistantMessage | undefined): string {
  if (!msg) return "";

  // Extract raw text from various API shapes
  let raw = "";
  if (typeof msg === "string") {
    raw = msg;
  } else if (typeof (msg as any).text === "string") {
    raw = (msg as any).text;
  } else if (typeof msg.content === "string") {
    raw = msg.content;
  } else if (Array.isArray(msg.content)) {
    const parts: string[] = [];
    for (const part of msg.content) {
      if (!part) continue;
      if (part.type === "text" && typeof part.text === "string") parts.push(part.text);
      else if (part.type === "thinking" && typeof (part as any).thinking === "string") parts.push((part as any).thinking);
      else if (typeof part === "string") parts.push(part);
    }
    raw = parts.join("");
  }

  // Parse JSON result field when response_format is json_object
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.result === "string") return parsed.result;
    } catch {
      // fall through
    }
  }

  return raw;
}

/** Try to parse a JSON object and extract its `.result` string. Returns undefined on failure. */
function tryParseJsonResult(text: string): string | undefined {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.result === "string") return parsed.result;
  } catch {
    // ignore
  }
  return undefined;
}

/** Strip common LLM wrapping artifacts (quotes, markdown, extra whitespace, meta prefixes). */
export function cleanLLMOutput(text: string): string {
  return text
    .trim()
    .replace(/^```[a-z]*\n?|\n?```$/g, "")          // fences
    .replace(/\n+/g, " ")                             // newlines → spaces
    .replace(/^["']+|["']+$/g, "")                   // wrapping quotes
    .replace(/^\s*(?:The user wants(?: me)? to|The user is|The user has|The user|User wants(?: me)? to|Here is the (?:topic|goal|summary):?)\s*/gi, "")
    .replace(/^\s*(?:Topic|Goal|Summary):?\s*/i, "")
    .trim();
}

export interface SummarizeResult {
  topic: string;
  goal: string;
  fullTopicPrompt: string;
  fullGoalPrompt: string;
  topicSystemPrompt: string;
  goalSystemPrompt: string;
  topicDebug: StreamDebug;
  goalDebug: StreamDebug;
}

export async function summarizeAchievement(
  ctx: ExtensionContext,
  assistantText: string,
  goal?: string,
): Promise<RunPromptResult> {
  return runPrompt(ctx, "achievement", assistantText, goal);
}

export async function summarize(
  ctx: ExtensionContext,
  message: string,
): Promise<SummarizeResult> {
  const [topicResult, goalResult] = await Promise.all([
    runPrompt(ctx, "topic", message),
    runPrompt(ctx, "goal", message),
  ]);

  return {
    topic: topicResult.text,
    goal: goalResult.text,
    fullTopicPrompt: topicResult.fullPrompt,
    fullGoalPrompt: goalResult.fullPrompt,
    topicSystemPrompt: topicResult.systemPrompt,
    goalSystemPrompt: goalResult.systemPrompt,
    topicDebug: topicResult.debug,
    goalDebug: goalResult.debug,
  };
}

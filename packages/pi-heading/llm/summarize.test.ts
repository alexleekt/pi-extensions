// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { readPromptFile, truncateToWords, summarize, cleanLLMOutput } from "./summarize.js";

describe("truncateToWords", () => {
  test("returns text unchanged when under limit", () => {
    expect(truncateToWords("hello world", 5)).toBe("hello world");
  });

  test("truncates to maxWords with ellipsis", () => {
    expect(truncateToWords("one two three four five", 3)).toBe("one two three…");
  });

  test("handles single word", () => {
    expect(truncateToWords("hello", 1)).toBe("hello");
  });

  test("handles empty string", () => {
    expect(truncateToWords("", 5)).toBe("");
  });

  test("handles whitespace-only string", () => {
    expect(truncateToWords("   ", 5)).toBe("");
  });

  test("handles exact limit", () => {
    expect(truncateToWords("one two three", 3)).toBe("one two three");
  });
});

describe("cleanLLMOutput", () => {
  test("strips wrapping quotes", () => {
    expect(cleanLLMOutput('"Docker setup"')).toBe("Docker setup");
    expect(cleanLLMOutput("'Kubernetes deploy'")).toBe("Kubernetes deploy");
  });

  test("strips markdown code fences", () => {
    expect(cleanLLMOutput("```\nFix the bug\n```")).toBe("Fix the bug");
    expect(cleanLLMOutput("```text\nRefactor code\n```")).toBe("Refactor code");
  });

  test("collapses newlines to spaces", () => {
    expect(cleanLLMOutput("Line one\nLine two")).toBe("Line one Line two");
  });

  test("strips 'The user wants me to...' prefix", () => {
    expect(cleanLLMOutput("The user wants me to validate the results")).toBe("validate the results");
  });

  test("strips 'The user wants to...' prefix", () => {
    expect(cleanLLMOutput("The user wants to fix the memory leak")).toBe("fix the memory leak");
  });

  test("strips 'The user is...' prefix", () => {
    expect(cleanLLMOutput("The user is asking about Docker setup")).toBe("asking about Docker setup");
  });

  test("strips 'User wants me to...' prefix", () => {
    expect(cleanLLMOutput("User wants me to write a test")).toBe("write a test");
  });

  test("strips 'Topic:' / 'Goal:' prefix", () => {
    expect(cleanLLMOutput("Topic: Docker setup")).toBe("Docker setup");
    expect(cleanLLMOutput("Goal: Fix the bug")).toBe("Fix the bug");
  });

  test("strips 'Here is the topic:' prefix", () => {
    expect(cleanLLMOutput("Here is the topic: Docker setup")).toBe("Docker setup");
  });

  test("handles multiple artifacts at once", () => {
    expect(cleanLLMOutput('```\n"The user wants to fix the bug"\n```')).toBe("fix the bug");
  });

  test("handles empty and whitespace", () => {
    expect(cleanLLMOutput("")).toBe("");
    expect(cleanLLMOutput("   ")).toBe("");
  });

  test("preserves valid clean output", () => {
    expect(cleanLLMOutput("Docker setup")).toBe("Docker setup");
    expect(cleanLLMOutput("Fix the memory leak")).toBe("Fix the memory leak");
  });
});

describe("readPromptFile", () => {
  let tmpUserDir: string;
  let tmpDefaultDir: string;

  beforeEach(() => {
    tmpUserDir = path.join(os.tmpdir(), `pi-heading-user-${Date.now()}`);
    tmpDefaultDir = path.join(os.tmpdir(), `pi-heading-default-${Date.now()}`);
    fs.mkdirSync(tmpUserDir, { recursive: true });
    fs.mkdirSync(tmpDefaultDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpUserDir, { recursive: true, force: true });
      fs.rmSync(tmpDefaultDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test("reads user prompt when available", () => {
    fs.writeFileSync(path.join(tmpUserDir, "topic.md"), "---\nmax_words: 6\n---\nUser topic prompt", "utf8");
    const result = readPromptFile("topic", tmpUserDir, tmpDefaultDir);
    expect(result.maxWords).toBe(6);
    expect(result.instructions).toBe("User topic prompt");
    expect(result.template).toBe("{message}");
  });

  test("falls back to default prompt when user missing", () => {
    fs.writeFileSync(path.join(tmpDefaultDir, "topic.md"), "---\nmax_words: 4\n---\nDefault topic prompt", "utf8");
    const result = readPromptFile("topic", tmpUserDir, tmpDefaultDir);
    expect(result.maxWords).toBe(4);
    expect(result.instructions).toBe("Default topic prompt");
  });

  test("prefers user over default", () => {
    fs.writeFileSync(path.join(tmpUserDir, "topic.md"), "---\nmax_words: 2\n---\nUser", "utf8");
    fs.writeFileSync(path.join(tmpDefaultDir, "topic.md"), "---\nmax_words: 8\n---\nDefault", "utf8");
    const result = readPromptFile("topic", tmpUserDir, tmpDefaultDir);
    expect(result.maxWords).toBe(2);
    expect(result.instructions).toBe("User");
  });

  test("uses fallback defaults when both missing", () => {
    const result = readPromptFile("missing", tmpUserDir, tmpDefaultDir);
    expect(result.maxWords).toBe(10);
    expect(result.instructions).toBe("Summarize the user's message concisely.");
    expect(result.template).toBe("{message}");
  });

  test("splits Message: prefix into instructions and template", () => {
    fs.writeFileSync(path.join(tmpDefaultDir, "goal.md"), "---\nmax_words: 15\n---\nGoal instructions.\nMessage: {message}", "utf8");
    const result = readPromptFile("goal", tmpUserDir, tmpDefaultDir);
    expect(result.maxWords).toBe(15);
    expect(result.instructions).toBe("Goal instructions.");
    expect(result.template).toBe("{message}");
  });

  test("handles missing max_words with default 10", () => {
    fs.writeFileSync(path.join(tmpDefaultDir, "topic.md"), "---\n---\nNo max_words here", "utf8");
    const result = readPromptFile("topic", tmpUserDir, tmpDefaultDir);
    expect(result.maxWords).toBe(10);
    expect(result.instructions).toBe("No max_words here");
  });

  test("strips frontmatter from instructions — never leaks to LLM", () => {
    fs.writeFileSync(path.join(tmpDefaultDir, "topic.md"), "---\nmax_words: 7\n---\nYou are a tagger.\n\nMessage: {message}", "utf8");
    const result = readPromptFile("topic", tmpUserDir, tmpDefaultDir);
    expect(result.instructions).not.toContain("max_words");
    expect(result.instructions).not.toContain("---");
    expect(result.instructions).toBe("You are a tagger.");
    expect(result.template).toBe("{message}");
    expect(result.maxWords).toBe(7);
  });
});

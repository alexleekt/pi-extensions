// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { describe, expect, test } from "bun:test";
import { stableTopic } from "./guard.js";

describe("stableTopic", () => {
  test("returns new topic when old is empty", () => {
    expect(stableTopic(undefined, "Docker setup")).toBe("Docker setup");
    expect(stableTopic("", "Docker setup")).toBe("Docker setup");
  });

  test("returns new topic when old is whitespace", () => {
    expect(stableTopic("   ", "Docker setup")).toBe("Docker setup");
  });

  test("keeps old topic on exact match (case insensitive)", () => {
    expect(stableTopic("Docker setup", "docker setup")).toBe("Docker setup");
    expect(stableTopic("docker setup", "Docker Setup")).toBe("docker setup");
  });

  test("keeps old topic on substring containment", () => {
    expect(stableTopic("Docker setup", "Docker")).toBe("Docker setup");
    expect(stableTopic("Docker", "Docker setup")).toBe("Docker");
  });

  test("keeps old topic when word overlap ≥ 70%", () => {
    expect(stableTopic("docker compose api setup", "docker compose api config")).toBe("docker compose api setup");
    expect(stableTopic("auth refactor api test", "auth refactor api fix")).toBe("auth refactor api test");
  });

  test("adopts new topic when word overlap < 70%", () => {
    expect(stableTopic("docker setup", "kubernetes deploy")).toBe("kubernetes deploy");
    expect(stableTopic("auth refactor", "ui styling pass")).toBe("ui styling pass");
  });

  test("preserves proper noun capitalization from old topic on exact match", () => {
    const old = "Chezmoi checkout";
    const neu = "chezmoi checkout";
    expect(stableTopic(old, neu)).toBe("Chezmoi checkout");
  });

  test("ignores punctuation during comparison", () => {
    expect(stableTopic("docker-setup", "docker setup")).toBe("docker-setup");
    expect(stableTopic("auth refactor!", "auth refactor")).toBe("auth refactor!");
    expect(stableTopic("node.js import", "node js import")).toBe("node.js import");
  });

  test("trims whitespace from returned topic on exact match", () => {
    expect(stableTopic("  docker setup  ", "docker setup")).toBe("docker setup");
  });

  test("completely different topics adopt the new one", () => {
    expect(stableTopic("frontend work", "database migration")).toBe("database migration");
  });
});

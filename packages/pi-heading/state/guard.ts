// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

/**
 * Topic stability guard.
 *
 * Prevents jitter between semantically-equivalent topic labels
 * (e.g. "docker setup" ↔ "docker config").
 *
 * Comparison is case-insensitive and strips punctuation.
 * When similarity is high, the old topic is returned to preserve its
 * original capitalization and formatting.
 */

const SIMILARITY_THRESHOLD = 0.7;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordOverlap(a: string, b: string): number {
  const aWords = new Set(normalize(a).split(" "));
  const bWords = new Set(normalize(b).split(" "));
  if (aWords.size === 0 || bWords.size === 0) return 0;

  let common = 0;
  for (const w of aWords) {
    if (bWords.has(w)) common++;
  }
  return common / Math.max(aWords.size, bWords.size);
}

export function stableTopic(oldTopic: string | undefined, newTopic: string): string {
  const trimmed = newTopic.trim();
  if (!oldTopic || oldTopic.trim() === "") return trimmed;

  const oldNorm = normalize(oldTopic);
  const newNorm = normalize(newTopic);

  if (oldNorm === newNorm) return oldTopic.trim();
  if (oldNorm.includes(newNorm) || newNorm.includes(oldNorm)) return oldTopic.trim();
  if (wordOverlap(oldTopic, newTopic) >= SIMILARITY_THRESHOLD) return oldTopic.trim();

  return trimmed;
}

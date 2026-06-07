import { exec, execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────

/** Source of truth for the statusline text, lowest to highest fidelity. */
type StatusSource = "wt" | "git" | "file" | "none";

interface StatuslineEntry {
  value: string;
  fetchedAt: number;
  ttlMs: number;
  branchAtFetch: string;
  source: StatusSource;
}

interface HealthState {
  consecutiveWtFailures: number;
  consecutiveWtSuccesses: number;
  degradedUntil: number;
  lastError: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 5_000;
const DEGRADED_TTL_MS = 15_000;
const WT_FAILURE_THRESHOLD = 3;
const WT_RECOVERY_THRESHOLD = 3;
const DEGRADED_COOLDOWN_MS = 30_000;

// ── Internal state ───────────────────────────────────────────────────────

const statuslineCache = new Map<string, StatuslineEntry>();
const health: HealthState = {
  consecutiveWtFailures: 0,
  consecutiveWtSuccesses: 0,
  degradedUntil: 0,
  lastError: null,
};

// ── Low-level git helpers ────────────────────────────────────────────────

function getBranchFromCwd(cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["branch", "--show-current"],
      { cwd, encoding: "utf-8" },
      (err, stdout) => {
        if (err) return resolve(null);
        resolve(stdout.trim() || null);
      },
    );
  });
}

function getAheadBehind(
  cwd: string,
  branch: string,
): Promise<{ ahead: number; behind: number } | null> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["rev-list", "--left-right", "--count", `${branch}...origin/${branch}`],
      { cwd, encoding: "utf-8" },
      (err, stdout) => {
        if (err) return resolve(null);
        const parts = stdout.trim().split(/\s+/);
        const behind = Number(parts[0]);
        const ahead = Number(parts[1]);
        if (Number.isNaN(behind) || Number.isNaN(ahead)) return resolve(null);
        resolve({ behind, ahead });
      },
    );
  });
}

function getRepoStatus(
  cwd: string,
): Promise<{ dirty: boolean; untracked: number }> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["status", "--porcelain"],
      { cwd, encoding: "utf-8" },
      (err, stdout) => {
        if (err) return resolve({ dirty: false, untracked: 0 });
        const lines = stdout.split("\n").filter(Boolean);
        const dirty = lines.some((l) => l[0] !== "?" && l[0] !== " ");
        const untracked = lines.filter((l) => l.startsWith("??")).length;
        resolve({ dirty, untracked });
      },
    );
  });
}

/** Read .git/HEAD directly — fastest, no subprocess, works even if git is slow. */
function readHeadFromFile(cwd: string): string | null {
  try {
    const headPath = path.join(cwd, ".git", "HEAD");
    const head = fs.readFileSync(headPath, "utf-8").trim();
    if (head.startsWith("ref: refs/heads/")) {
      return head.slice(16);
    }
    return head.slice(0, 7); // detached HEAD — short hash
  } catch {
    return null;
  }
}

// ── wt statusline (layer 1) ────────────────────────────────────────────────

function execWtStatusline(cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    exec(
      "wt list statusline --format=table 2>/dev/null",
      { cwd, encoding: "utf-8", timeout: 3000 },
      (err, stdout) => {
        if (err || !stdout.trim()) {
          recordWtFailure(err?.message || "empty output");
          return resolve(null);
        }
        recordWtSuccess();
        resolve(stdout.trim());
      },
    );
  });
}

// ── Health tracking ────────────────────────────────────────────────────────

function isDegraded(): boolean {
  return Date.now() < health.degradedUntil;
}

function recordWtSuccess(): void {
  health.consecutiveWtFailures = 0;
  health.consecutiveWtSuccesses++;
  health.lastError = null;
  if (health.consecutiveWtSuccesses >= WT_RECOVERY_THRESHOLD) {
    health.degradedUntil = 0; // self-recover: exit degraded mode
  }
}

function recordWtFailure(error: string): void {
  health.consecutiveWtSuccesses = 0;
  health.consecutiveWtFailures++;
  health.lastError = error;
  if (health.consecutiveWtFailures >= WT_FAILURE_THRESHOLD) {
    health.degradedUntil = Date.now() + DEGRADED_COOLDOWN_MS;
  }
}

// ── Cache helpers ──────────────────────────────────────────────────────────

function cacheKey(cwd: string, branch: string): string {
  return `${cwd}#${branch}`;
}

function isStale(entry: StatuslineEntry, expectedBranch: string): boolean {
  const age = Date.now() - entry.fetchedAt;
  // Stale if: TTL exceeded, or branch mismatch, or emergency 2×TTL cap
  return (
    age > entry.ttlMs ||
    entry.branchAtFetch !== expectedBranch ||
    age > entry.ttlMs * 2
  );
}

/** Build a git-derived statusline (layer 2 fallback). */
async function buildGitStatus(
  cwd: string,
  branch: string,
): Promise<string | null> {
  const [ab, repoStatus] = await Promise.all([
    getAheadBehind(cwd, branch),
    getRepoStatus(cwd),
  ]);

  const parts: string[] = [branch];

  if (ab) {
    const indicators: string[] = [];
    if (ab.ahead > 0) indicators.push(`⇡${ab.ahead}`);
    if (ab.behind > 0) indicators.push(`⇣${ab.behind}`);
    if (indicators.length) parts.push(indicators.join(" "));
  }

  if (repoStatus.dirty) parts.push("✗");
  if (repoStatus.untracked > 0) parts.push(`+${repoStatus.untracked}`);

  return parts.join(" ");
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Fetch a robust statusline string for the given directory.
 *
 * Resolution order (highest fidelity first):
 *   1. `wt list statusline` — includes ahead/behind, dirty, untracked, compact
 *   2. `git branch --show-current` + `git rev-list` + `git status --porcelain` — manual reconstruction
 *   3. Read `.git/HEAD` directly — no subprocess, minimal info (branch name only)
 *
 * Self-recovery features:
 *   - Cache keyed by `cwd#branch` → automatic invalidation on branch switch within same dir
 *   - Degraded mode: after 3 consecutive wt failures, switch to git-only for 30s
 *   - Auto-recovery: after 3 consecutive wt successes, exit degraded mode
 *   - Stale detection: if cache age > 2× TTL or branch mismatch, force refresh
 */
export async function fetchStatusline(
  cwd: string,
  expectedBranch: string | null,
  forceRefresh = false,
): Promise<string | null> {
  // Fastest: try .git/HEAD first to get the branch name (no subprocess)
  const branch = expectedBranch || (await getBranchFromCwd(cwd)) || readHeadFromFile(cwd);
  if (!branch) return null;

  const key = cacheKey(cwd, branch);
  const cached = statuslineCache.get(key);

  // Cache hit + no staleness indicators
  if (!forceRefresh && cached && !isStale(cached, branch)) {
    return cached.value;
  }

  // Layer 1: wt (skip if in degraded mode)
  if (!isDegraded()) {
    const wtResult = await execWtStatusline(cwd);
    if (wtResult) {
      const ttl =
        health.consecutiveWtSuccesses >= 3 ? DEFAULT_TTL_MS : DEGRADED_TTL_MS;
      statuslineCache.set(key, {
        value: wtResult,
        fetchedAt: Date.now(),
        ttlMs: ttl,
        branchAtFetch: branch,
        source: "wt",
      });
      return wtResult;
    }
  }

  // Layer 2: git reconstruction
  const gitResult = await buildGitStatus(cwd, branch);
  if (gitResult) {
    statuslineCache.set(key, {
      value: gitResult,
      fetchedAt: Date.now(),
      ttlMs: DEGRADED_TTL_MS,
      branchAtFetch: branch,
      source: "git",
    });
    return gitResult;
  }

  // Layer 3: .git/HEAD file read
  const fileResult = readHeadFromFile(cwd);
  if (fileResult) {
    statuslineCache.set(key, {
      value: fileResult,
      fetchedAt: Date.now(),
      ttlMs: 1_000,
      branchAtFetch: branch,
      source: "file",
    });
    return fileResult;
  }

  return null;
}

/** Invalidate cache for a specific directory/branch pair, or all. */
export function invalidateStatusline(
  cwd?: string,
  branch?: string,
): void {
  if (cwd && branch) {
    statuslineCache.delete(cacheKey(cwd, branch));
  } else if (cwd) {
    for (const key of statuslineCache.keys()) {
      if (key.startsWith(`${cwd}#`)) statuslineCache.delete(key);
    }
  } else {
    statuslineCache.clear();
  }
}

/**
 * Detect if the branch has changed since `lastKnown`.
 * Returns the current branch and invalidates the old cache if drifted.
 */
export async function detectBranchChange(
  cwd: string,
  lastKnown: string | null,
): Promise<string | null> {
  const current = await getBranchFromCwd(cwd);
  if (current && current !== lastKnown) {
    // Branch drift detected — invalidate both old and new cache entries
    if (lastKnown) invalidateStatusline(cwd, lastKnown);
    if (current) invalidateStatusline(cwd, current);
  }
  return current;
}

/** Get health metrics for debugging / diagnostics. */
export function getHealth(): Readonly<HealthState> {
  return { ...health };
}

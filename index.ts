import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { exec, execFile, spawn } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";

// ── Helpers ────────────────────────────────────────────────────────────────

function getBranchFromCwd(cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["branch", "--show-current"],
      { cwd, encoding: "utf-8" },
      (err, stdout) => {
        if (err) return resolve(null);
        resolve(stdout.trim() || null);
      }
    );
  });
}

function isInsideGitRepo(cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["rev-parse", "--is-inside-work-tree"],
      { cwd, encoding: "utf-8" },
      (err, stdout) => {
        resolve(!err && stdout.trim() === "true");
      }
    );
  });
}

function setMarker(cwd: string, branch: string, marker: string): Promise<void> {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ marker, set_at: Date.now() });
    exec(
      `git config worktrunk.state.${branch}.marker '${payload}'`,
      { cwd },
      () => resolve() // ignore errors (e.g., no git repo)
    );
  });
}

function clearMarker(cwd: string, branch: string): Promise<void> {
  return new Promise((resolve) => {
    exec(
      `git config --unset worktrunk.state.${branch}.marker 2>/dev/null || true`,
      { cwd },
      () => resolve()
    );
  });
}

interface StatuslineCache {
  value: string;
  fetchedAt: number;
  ttlMs: number;
}

const statuslineCache: Map<string, StatuslineCache> = new Map();
const DEFAULT_STATUSLINE_TTL_MS = 30_000; // 30 seconds

function fetchStatusline(cwd: string, forceRefresh = false): Promise<string | null> {
  return new Promise((resolve) => {
    const now = Date.now();
    const cached = statuslineCache.get(cwd);
    if (!forceRefresh && cached && now - cached.fetchedAt < cached.ttlMs) {
      return resolve(cached.value);
    }

    exec(
      "wt list statusline --format=claude-code 2>/dev/null",
      { cwd, encoding: "utf-8", timeout: 3000 },
      (err, stdout) => {
        if (err || !stdout.trim()) return resolve(null);
        const value = stdout.trim();
        statuslineCache.set(cwd, { value, fetchedAt: now, ttlMs: DEFAULT_STATUSLINE_TTL_MS });
        resolve(value);
      }
    );
  });
}

function invalidateStatuslineCache(cwd?: string) {
  if (cwd) {
    statuslineCache.delete(cwd);
  } else {
    statuslineCache.clear();
  }
}

function findWorktreePath(cwd: string, branch: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["worktree", "list", "--porcelain"],
      { cwd, encoding: "utf-8" },
      (err, stdout) => {
        if (err) return resolve(null);
        const lines = stdout.split("\n");
        let currentPath: string | null = null;
        for (const line of lines) {
          if (line.startsWith("worktree ")) {
            currentPath = line.slice(9);
          } else if (line.startsWith("branch ") && currentPath) {
            const branchRef = line.slice(7); // refs/heads/<branch>
            const branchName = branchRef.replace("refs/heads/", "");
            if (branchName === branch) {
              return resolve(currentPath);
            }
          }
        }
        resolve(null);
      }
    );
  });
}

function detectMultiplexer(): "tmux" | "zellij" | "herdr" | null {
  if (process.env.TMUX) return "tmux";
  if (process.env.ZELLIJ) return "zellij";
  if (process.env.HERDR_ENV === "1") return "herdr";
  return null;
}

interface WorktreeEntry {
  path: string;
  branch: string;
  head: string;
  isBare: boolean;
}

function listWorktrees(cwd: string): Promise<WorktreeEntry[]> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["worktree", "list", "--porcelain"],
      { cwd, encoding: "utf-8" },
      (err, stdout) => {
        if (err) return resolve([]);
        const entries: WorktreeEntry[] = [];
        const lines = stdout.split("\n");
        let current: Partial<WorktreeEntry> = {};
        for (const line of lines) {
          if (line.startsWith("worktree ")) {
            if (current.path) entries.push(current as WorktreeEntry);
            current = { path: line.slice(9) };
          } else if (line.startsWith("HEAD ")) {
            current.head = line.slice(5);
          } else if (line.startsWith("branch ")) {
            current.branch = line.slice(7).replace("refs/heads/", "");
          } else if (line === "bare") {
            current.isBare = true;
          }
        }
        if (current.path) entries.push(current as WorktreeEntry);
        resolve(entries);
      }
    );
  });
}

function getWorktreeMarker(cwd: string, branch: string): Promise<string | null> {
  return new Promise((resolve) => {
    exec(
      `git config worktrunk.state.${branch}.marker 2>/dev/null || true`,
      { cwd, encoding: "utf-8" },
      (err, stdout) => {
        if (err || !stdout.trim()) return resolve(null);
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed.marker || null);
        } catch {
          resolve(null);
        }
      }
    );
  });
}

async function buildWorktreeSelectItems(cwd: string): Promise<SelectItem[]> {
  const entries = await listWorktrees(cwd);
  const items: SelectItem[] = [];
  for (const entry of entries) {
    if (entry.isBare || !entry.branch) continue;
    const marker = await getWorktreeMarker(cwd, entry.branch);
    const shortPath = entry.path.replace(os.homedir(), "~");
    const label = marker ? `${entry.branch}  ${marker}` : entry.branch;
    items.push({
      value: entry.branch,
      label,
      description: shortPath,
    });
  }
  return items;
}

function getGitAheadBehind(cwd: string): Promise<{ ahead: number; behind: number } | null> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["rev-parse", "--abbrev-ref", "@{upstream}"],
      { cwd, encoding: "utf-8" },
      (err, upstream) => {
        if (err) return resolve(null);
        execFile(
          "git",
          ["rev-list", "--left-right", "--count", `HEAD...${upstream.trim()}`],
          { cwd, encoding: "utf-8" },
          (err2, stdout) => {
            if (err2) return resolve(null);
            const match = stdout.trim().match(/(\d+)\s+(\d+)/);
            if (!match) return resolve(null);
            resolve({ ahead: parseInt(match[1], 10), behind: parseInt(match[2], 10) });
          }
        );
      }
    );
  });
}

async function buildWidgetLines(cwd: string, branch: string, marker: string): Promise<string[]> {
  const ab = await getGitAheadBehind(cwd);
  let parts = [`🌲 ${branch}`];
  if (marker) parts.push(marker);
  if (ab) {
    if (ab.ahead > 0) parts.push(`↑${ab.ahead}`);
    if (ab.behind > 0) parts.push(`⇡${ab.behind}`);
  }
  return [parts.join("  ")];
}

// ── Extension ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let currentBranch: string | null = null;
  let markerSet = false;

  // ── Activity Tracking ─────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    const cwd = ctx.cwd;
    if (!(await isInsideGitRepo(cwd))) return;

    const branch = await getBranchFromCwd(cwd);
    currentBranch = branch;

    if (branch) {
      await setMarker(cwd, branch, "💬");
      markerSet = true;
    }

    if (!ctx.hasUI) return;

    // Update statusline on startup (cached)
    const status = await fetchStatusline(cwd);
    if (status) ctx.ui.setStatus("worktrunk", status);

    // Update widget with branch + marker
    if (branch) {
      const lines = await buildWidgetLines(cwd, branch, "💬");
      ctx.ui.setWidget("worktrunk", lines);
    }
  });

  pi.on("turn_start", async (_event, ctx) => {
    const cwd = ctx.cwd;
    if (!markerSet) return;
    const branch = currentBranch || (await getBranchFromCwd(cwd));
    if (branch) {
      currentBranch = branch;
      await setMarker(cwd, branch, "🤖");
      if (ctx.hasUI) {
        const lines = await buildWidgetLines(cwd, branch, "🤖");
        ctx.ui.setWidget("worktrunk", lines);
      }
    }
  });

  pi.on("turn_end", async (_event, ctx) => {
    const cwd = ctx.cwd;
    if (!markerSet) return;
    const branch = currentBranch || (await getBranchFromCwd(cwd));
    if (branch) {
      currentBranch = branch;
      await setMarker(cwd, branch, "💬");
    }

    if (!ctx.hasUI) return;

    // Refresh statusline after each turn (cached to avoid 1–2s CI latency)
    const status = await fetchStatusline(cwd);
    if (status) ctx.ui.setStatus("worktrunk", status);

    // Refresh widget
    if (branch) {
      const lines = await buildWidgetLines(cwd, branch, "💬");
      ctx.ui.setWidget("worktrunk", lines);
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    const cwd = ctx.cwd;
    const branch = currentBranch || (await getBranchFromCwd(cwd));
    if (branch) {
      await clearMarker(cwd, branch);
      markerSet = false;
    }
    if (ctx.hasUI) {
      ctx.ui.setWidget("worktrunk", []);
    }
  });

  // ── /wt-switch-create Command ─────────────────────────────────────────

  pi.registerCommand("wt-switch-create", {
    description:
      "Create or re-enter a worktrunk worktree and switch Pi into it. Usage: /wt-switch-create <branch> [<repo>] [-- <task>]",
    handler: async (args, ctx) => {
      const raw = (args || "").trim();
      if (!raw) {
        if (ctx.hasUI) ctx.ui.notify("Usage: /wt-switch-create <branch> [<repo>] [-- <task>]", "error");
        return;
      }

      const dashDashIdx = raw.indexOf(" -- ");
      let task: string | undefined;
      let beforeTask = raw;
      if (dashDashIdx !== -1) {
        task = raw.slice(dashDashIdx + 4).trim();
        beforeTask = raw.slice(0, dashDashIdx).trim();
      }

      const parts = beforeTask.split(" ");
      const branch = parts[0];
      const repo = parts[1];

      const cwd = ctx.cwd;
      const mux = detectMultiplexer();

      if (ctx.hasUI) ctx.ui.notify(`Creating worktree: ${branch}…`, "info");

      // Build wt command
      const wtArgs = ["switch", "--create", branch];
      if (repo) wtArgs.push("--repo", repo);

      try {
        await pi.exec("wt", wtArgs, { cwd });
      } catch (e: any) {
        if (ctx.hasUI) ctx.ui.notify(`wt failed: ${e.message || e}`, "error");
        return;
      }

      // Determine worktree path by querying git (handles custom worktree-path templates)
      let worktreePath = await findWorktreePath(cwd, branch);
      if (!worktreePath) {
        // Fallback to sibling layout guess
        const repoName = repo || path.basename(cwd);
        worktreePath = path.resolve(cwd, `../${repoName}.${branch}`);
      }

      if (!mux) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            `Worktree created at ${worktreePath}. No multiplexer detected — run: cd ${worktreePath} && pi`,
            "info"
          );
        }
        return;
      }

      // Relaunch Pi in the worktree via the detected multiplexer
      const cmd = task
        ? `cd ${worktreePath} && pi "${task}"`
        : `cd ${worktreePath} && pi`;

      try {
        if (mux === "tmux") {
          await pi.exec("tmux", [
            "send-keys",
            "-t",
            `tmux:${process.env.TMUX_PANE || ""}`,
            cmd,
            "Enter",
          ]);
        } else if (mux === "zellij") {
          await pi.exec("zellij", ["run", "--", cmd]);
        } else if (mux === "herdr") {
          await pi.exec("herdr", [
            "pane",
            "run",
            process.env.HERDR_PANE_ID || "",
            cmd,
          ]);
        }
        if (ctx.hasUI) ctx.ui.notify(`Sent relaunch command via ${mux}.`, "info");
      } catch (e: any) {
        if (ctx.hasUI) ctx.ui.notify(`Multiplexer relaunch failed: ${e.message || e}`, "error");
      }
    },
  });

  // ── /wt-list Command ──────────────────────────────────────────────────

  pi.registerCommand("wt-list", {
    description: "Interactive worktree list — navigate and switch with Enter",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        // Non-interactive fallback
        const cwd = ctx.cwd;
        try {
          const result = await new Promise<string>((resolve, reject) => {
            execFile("wt", ["list"], { cwd, encoding: "utf-8" }, (err, stdout) => {
              if (err) return reject(err);
              resolve(stdout);
            });
          });
          ctx.ui.notify(result.slice(0, 500), "info");
        } catch (e: any) {
          ctx.ui.notify(`wt list failed: ${e.message || e}`, "error");
        }
        return;
      }

      const cwd = ctx.cwd;
      const items = await buildWorktreeSelectItems(cwd);
      if (items.length === 0) {
        ctx.ui.notify("No worktrees found.", "warning");
        return;
      }

      const result = await ctx.ui.custom<string | null>(
        (tui, theme, _kb, done) => {
          const container = new Container();

          // Top border
          container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

          // Title
          container.addChild(new Text(theme.fg("accent", theme.bold("Worktrees — ↑↓ select • Enter switch • Esc cancel")), 1, 0));

          // SelectList with theme
          const selectList = new SelectList(items, Math.min(items.length, 12), {
            selectedPrefix: (t) => theme.fg("accent", t),
            selectedText: (t) => theme.fg("accent", t),
            description: (t) => theme.fg("muted", t),
            scrollInfo: (t) => theme.fg("dim", t),
            noMatch: (t) => theme.fg("warning", t),
          });
          selectList.onSelect = (item) => done(item.value);
          selectList.onCancel = () => done(null);
          container.addChild(selectList);

          // Bottom border
          container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

          return {
            render: (w) => container.render(w),
            invalidate: () => container.invalidate(),
            handleInput: (data) => { selectList.handleInput(data); tui.requestRender(); },
          };
        },
        { overlay: true, overlayOptions: { anchor: "top-center", maxHeight: "60%", width: "80%", minWidth: 60 } }
      );

      if (!result) return; // cancelled

      // Switch to selected worktree (same relaunch logic as /wt-switch-create)
      const branch = result;
      const mux = detectMultiplexer();

      let worktreePath = await findWorktreePath(cwd, branch);
      if (!worktreePath) {
        const repoName = path.basename(cwd);
        worktreePath = path.resolve(cwd, `../${repoName}.${branch}`);
      }

      if (!mux) {
        ctx.ui.notify(`Worktree: ${worktreePath}. Run: cd ${worktreePath} && pi`, "info");
        return;
      }

      const cmd = `cd ${worktreePath} && pi`;
      try {
        if (mux === "tmux") {
          await pi.exec("tmux", ["send-keys", "-t", `tmux:${process.env.TMUX_PANE || ""}`, cmd, "Enter"]);
        } else if (mux === "zellij") {
          await pi.exec("zellij", ["run", "--", cmd]);
        } else if (mux === "herdr") {
          await pi.exec("herdr", ["pane", "run", process.env.HERDR_PANE_ID || "", cmd]);
        }
        ctx.ui.notify(`Switched to ${branch} via ${mux}.`, "info");
      } catch (e: any) {
        ctx.ui.notify(`Switch failed: ${e.message || e}`, "error");
      }
    },
  });

  // ── /wt-statusline-refresh Command ────────────────────────────────────

  pi.registerCommand("wt-statusline-refresh", {
    description: "Force-refresh the worktrunk statusline (bypasses cache)",
    handler: async (_args, ctx) => {
      const cwd = ctx.cwd;
      invalidateStatuslineCache(cwd);
      try {
        const status = await fetchStatusline(cwd, true);
        if (status && ctx.hasUI) {
          ctx.ui.setStatus("worktrunk", status);
          ctx.ui.notify("Statusline refreshed.", "info");
        } else if (ctx.hasUI) {
          ctx.ui.notify("No statusline available.", "warning");
        }
      } catch (e: any) {
        if (ctx.hasUI) ctx.ui.notify(`Refresh failed: ${e.message || e}`, "error");
      }
    },
  });

  // ── spawn_worktree_agent Tool ─────────────────────────────────────────

  pi.registerTool({
    name: "spawn_worktree_agent",
    label: "Spawn Worktree Agent",
    description:
      "Create a worktrunk worktree for a branch and spawn a Pi subagent in it. If the worktree already exists, the agent is spawned in the existing directory.",
    parameters: Type.Object({
      branch: Type.String({ description: "Branch name for the worktree" }),
      task: Type.String({ description: "Task description for the subagent" }),
      repo: Type.Optional(Type.String({ description: "Optional repo name (defaults to current repo)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd;
      const branch = params.branch;
      const repo = params.repo;
      const task = params.task;

      // 1. Create worktree
      const wtArgs = ["switch", "--create", branch];
      if (repo) wtArgs.push("--repo", repo);

      try {
        await pi.exec("wt", wtArgs, { cwd });
      } catch (e: any) {
        return {
          content: [
            { type: "text", text: `Failed to create worktree: ${e.message || e}` },
          ],
          details: {},
          isError: true,
        } as any;
      }

      // 2. Determine worktree path by querying git (handles custom templates)
      let worktreePath = await findWorktreePath(cwd, branch);
      if (!worktreePath) {
        const repoName = repo || path.basename(cwd);
        worktreePath = path.resolve(cwd, `../${repoName}.${branch}`);
      }

      // 3. Spawn subagent via the official pi subagent pattern
      const subagentArgs = [
        "--mode", "json",
        "-p",
        "--no-session",
        `--cwd`, worktreePath,
        task,
      ];

      return new Promise((resolve) => {
        const proc = spawn("pi", subagentArgs, {
          cwd: worktreePath,
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
        proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

        proc.on("close", (code) => {
          const exitCode = code ?? 1;

          const lastMessage = stdout
            .split("\n")
            .filter(Boolean)
            .map((line: string) => {
              try { return JSON.parse(line); } catch { return null; }
            })
            .filter((e: any) => e && e.type === "message_end" && e.message?.role === "assistant")
            .pop();

          const output = lastMessage?.message?.content?.[0]?.text || stdout.slice(-500) || "(no output)";

          resolve({
            content: [
              {
                type: "text",
                text:
                  exitCode === 0
                    ? `Subagent completed in ${worktreePath}:\n${output}`
                    : `Subagent failed (exit ${exitCode}) in ${worktreePath}:\n${stderr || output}`,
              },
            ],
            details: {},
            isError: exitCode !== 0,
          } as any);
        });

        proc.on("error", (err) => {
          resolve({
            content: [
              { type: "text", text: `Failed to spawn subagent: ${err.message}` },
            ],
            details: {},
            isError: true,
          } as any);
        });
      });
    },
  });
}

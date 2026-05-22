import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { exec, execFile, spawn } from "node:child_process";
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

function fetchStatusline(cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    exec(
      "wt list statusline --format=claude-code 2>/dev/null",
      { cwd, encoding: "utf-8", timeout: 3000 },
      (err, stdout) => {
        if (err || !stdout.trim()) return resolve(null);
        resolve(stdout.trim());
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

    // Update statusline on startup
    if (ctx.hasUI) {
      const status = await fetchStatusline(cwd);
      if (status) ctx.ui.setStatus("worktrunk", status);
    }
  });

  pi.on("turn_start", async (_event, ctx) => {
    const cwd = ctx.cwd;
    if (!markerSet) return;
    const branch = currentBranch || (await getBranchFromCwd(cwd));
    if (branch) {
      currentBranch = branch;
      await setMarker(cwd, branch, "🤖");
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

    // Refresh statusline after each turn
    if (ctx.hasUI) {
      const status = await fetchStatusline(cwd);
      if (status) ctx.ui.setStatus("worktrunk", status);
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    const cwd = ctx.cwd;
    const branch = currentBranch || (await getBranchFromCwd(cwd));
    if (branch) {
      await clearMarker(cwd, branch);
      markerSet = false;
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

      // Determine worktree path (worktrunk uses sibling layout: <repo>.<branch>/)
      const repoName = repo || path.basename(cwd);
      const worktreePath = path.resolve(cwd, `../${repoName}.${branch}`);

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
    description: "Run wt list and display output",
    handler: async (_args, ctx) => {
      const cwd = ctx.cwd;
      try {
        const result = await new Promise<string>((resolve, reject) => {
          execFile("wt", ["list"], { cwd, encoding: "utf-8" }, (err, stdout) => {
            if (err) return reject(err);
            resolve(stdout);
          });
        });
        if (ctx.hasUI) ctx.ui.notify(result.slice(0, 500), "info");
      } catch (e: any) {
        if (ctx.hasUI) ctx.ui.notify(`wt list failed: ${e.message || e}`, "error");
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

      // 2. Determine worktree path
      const repoName = repo || path.basename(cwd);
      const worktreePath = path.resolve(cwd, `../${repoName}.${branch}`);

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

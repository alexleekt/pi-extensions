import type { ExtensionAPI, ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { exec, execFile, spawn } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";

// ── Helpers ────────────────────────────────────────────────────────────────

function visibleLen(s: string): number {
  // Strip ANSI escape sequences and return visible character count
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

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

  // Create option always first
  items.push({
    value: "__create__",
    label: "[+] Create new worktree",
    description: "wt switch --create",
  });

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

async function relaunchInWorktree(
  pi: ExtensionAPI,
  ctx: { hasUI: boolean; ui: ExtensionUIContext; cwd: string },
  branch: string,
  repo?: string,
  task?: string,
): Promise<void> {
  const mux = detectMultiplexer();

  let worktreePath = await findWorktreePath(ctx.cwd, branch);
  if (!worktreePath) {
    const repoName = repo || path.basename(ctx.cwd);
    worktreePath = path.resolve(ctx.cwd, `../${repoName}.${branch}`);
  }

  if (!mux) {
    if (ctx.hasUI) {
      ctx.ui.notify(
        `Worktree: ${worktreePath}. No multiplexer — run: cd ${worktreePath} && pi`,
        "info",
      );
    }
    return;
  }

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
      await pi.exec("herdr", ["pane", "run", process.env.HERDR_PANE_ID || "", cmd]);
    }
    if (ctx.hasUI) ctx.ui.notify(`Switched to ${branch} via ${mux}.`, "info");
  } catch (e: any) {
    if (ctx.hasUI) ctx.ui.notify(`Switch failed: ${e.message || e}`, "error");
  }
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

      if (ctx.hasUI) ctx.ui.notify(`Creating worktree: ${branch}…`, "info");

      const wtArgs = ["switch", "--create", branch];
      if (repo) wtArgs.push("--repo", repo);

      try {
        await pi.exec("wt", wtArgs, { cwd: ctx.cwd });
      } catch (e: any) {
        if (ctx.hasUI) ctx.ui.notify(`wt failed: ${e.message || e}`, "error");
        return;
      }

      await relaunchInWorktree(pi, ctx, branch, repo, task);
    },
  });

  // ── /wt-list Command ──────────────────────────────────────────────────

  pi.registerCommand("wt-list", {
    description: "Interactive worktree list — select to switch, or create new",
    handler: async (_args, ctx) => {
      const cwd = ctx.cwd;

      // Non-interactive fallback
      if (!ctx.hasUI) {
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

      const items = await buildWorktreeSelectItems(cwd);

      const result = await ctx.ui.custom<string | null>(
        (tui, theme, _kb, done) => {
          const container = new Container();
          const accent = (s: string) => theme.fg("accent", s);
          const muted = (s: string) => theme.fg("muted", s);
          const dim = (s: string) => theme.fg("dim", s);

          // Title + hints
          container.addChild(new Text(accent(theme.bold("Worktrees")), 1, 0));
          container.addChild(new Text(dim("↑↓ select • Enter switch • Esc cancel"), 1, 0));
          container.addChild(new Spacer(1));

          // SelectList
          const listHeight = Math.min(items.length, 10);
          const selectList = new SelectList(items, listHeight, {
            selectedPrefix: accent,
            selectedText: accent,
            description: muted,
            scrollInfo: dim,
            noMatch: (t) => theme.fg("warning", t),
          });
          selectList.onSelect = (item) => done(item.value);
          selectList.onCancel = () => done(null);
          container.addChild(selectList);

          return {
            render: (w) => {
              const innerW = Math.max(w - 4, 20); // │ + space + content + space + │
              const lines = container.render(innerW);

              const top = "╭" + "─".repeat(innerW + 2) + "╮";
              const bottom = "╰" + "─".repeat(innerW + 2) + "╯";

              const body = lines.map((line) => {
                const vis = visibleLen(line);
                const pad = " ".repeat(Math.max(0, innerW - vis));
                return "│ " + line + pad + " │";
              });

              return [top, ...body, bottom];
            },
            invalidate: () => container.invalidate(),
            handleInput: (data) => { selectList.handleInput(data); tui.requestRender(); },
          };
        },
        {
          overlay: true,
          overlayOptions: {
            anchor: "bottom-left",
            width: "45%",
            minWidth: 45,
            maxHeight: "40%",
            margin: { bottom: 3, left: 2 },
          },
        }
      );

      if (!result) return; // cancelled

      // ── Create new worktree ──
      if (result === "__create__") {
        const branch = await ctx.ui.input("Branch name for new worktree");
        if (!branch || !branch.trim()) return;

        const trimmed = branch.trim();
        if (ctx.hasUI) ctx.ui.notify(`Creating worktree: ${trimmed}…`, "info");

        try {
          await pi.exec("wt", ["switch", "--create", trimmed], { cwd });
        } catch (e: any) {
          if (ctx.hasUI) ctx.ui.notify(`wt failed: ${e.message || e}`, "error");
          return;
        }

        await relaunchInWorktree(pi, ctx, trimmed);
        return;
      }

      // ── Switch to existing worktree ──
      await relaunchInWorktree(pi, ctx, result);
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

import { exec, execFile, spawn } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";
import type {
    AgentToolResult,
    ExtensionAPI,
    ExtensionUIContext,
} from "@earendil-works/pi-coding-agent";
import {
    Container,
    type SelectItem,
    SelectList,
    Spacer,
    Text,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Narrow an unknown error to a string message. */
function errMsg(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

/** Journal entry shape produced by JSON.parse of Pi JSONL output. */
interface JournalEntry {
    type?: string;
    message?: { role?: string; content?: Array<{ text?: string }> };
}

function visibleLen(s: string): number {
    // Strip ANSI escape sequences and return visible character count
    // biome-ignore lint/suspicious/noControlCharactersInRegex: well-known ANSI escape stripping pattern
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
            },
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
            },
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
            },
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
                        if (current.path)
                            entries.push(current as WorktreeEntry);
                        current = { path: line.slice(9) };
                    } else if (line.startsWith("HEAD ")) {
                        current.head = line.slice(5);
                    } else if (line.startsWith("branch ")) {
                        current.branch = line
                            .slice(7)
                            .replace("refs/heads/", "");
                    } else if (line === "bare") {
                        current.isBare = true;
                    }
                }
                if (current.path) entries.push(current as WorktreeEntry);
                resolve(entries);
            },
        );
    });
}

function getWorktreeMarker(
    cwd: string,
    branch: string,
): Promise<string | null> {
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
            },
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

/** Create a herdr workspace for a worktree and run Pi in it. */
async function relaunchInWorktreeHerdr(
    pi: ExtensionAPI,
    ctx: { hasUI: boolean; ui: ExtensionUIContext; cwd: string },
    branch: string,
    repo?: string,
    task?: string,
): Promise<void> {
    let worktreePath = await findWorktreePath(ctx.cwd, branch);
    if (!worktreePath) {
        const repoName = repo || path.basename(ctx.cwd);
        worktreePath = path.resolve(ctx.cwd, `../${repoName}.${branch}`);
    }

    const cmd = task
        ? `cd ${worktreePath} && pi "${task}"`
        : `cd ${worktreePath} && pi`;

    try {
        // Create a new workspace for the worktree
        const workspaceResult = await new Promise<string>((resolve, reject) => {
            exec(
                `herdr workspace create --cwd ${worktreePath} --label ${branch} --no-focus`,
                { encoding: "utf-8" },
                (err, stdout) => {
                    if (err) return reject(err);
                    resolve(stdout);
                },
            );
        });

        // Parse the workspace ID and root pane from the JSON output
        let workspaceId: string | undefined;
        let rootPaneId: string | undefined;
        try {
            const parsed = JSON.parse(workspaceResult);
            workspaceId = parsed.result?.workspace?.workspace_id;
            rootPaneId = parsed.result?.workspace?.root_pane;
        } catch {
            // Fallback: try to find the workspace by listing
            const listResult = await new Promise<string>((resolve, reject) => {
                exec("herdr workspace list", { encoding: "utf-8" }, (err, stdout) => {
                    if (err) return reject(err);
                    resolve(stdout);
                });
            });
            try {
                const parsed = JSON.parse(listResult);
                const workspaces = parsed.result?.workspaces || [];
                const ws = workspaces.find((w: { label?: string }) => w.label === branch);
                if (ws) {
                    workspaceId = ws.workspace_id;
                    rootPaneId = ws.root_pane;
                }
            } catch {
                // ignore
            }
        }

        if (!rootPaneId) {
            // Fallback: run in current pane
            await pi.exec("herdr", ["pane", "run", process.env.HERDR_PANE_ID || "", cmd]);
            if (ctx.hasUI) ctx.ui.notify(`Switched to ${branch} in current pane.`, "info");
            return;
        }

        // Run Pi in the new workspace's root pane
        await pi.exec("herdr", ["pane", "run", rootPaneId, cmd]);
        if (ctx.hasUI) ctx.ui.notify(`Created workspace ${branch} and launched Pi.`, "info");
    } catch (e) {
        if (ctx.hasUI) ctx.ui.notify(`Workspace creation failed: ${errMsg(e)}`, "error");
    }
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

    // Propagate session name to the new worktree
    try {
        pi.setSessionName(branch);
    } catch {
        // ignore if not available
    }

    if (mux === "herdr") {
        await relaunchInWorktreeHerdr(pi, ctx, branch, repo, task);
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
        }
        if (ctx.hasUI)
            ctx.ui.notify(`Switched to ${branch} via ${mux}.`, "info");
    } catch (e) {
        if (ctx.hasUI) ctx.ui.notify(`Switch failed: ${errMsg(e)}`, "error");
    }
}

// ── Extension ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
    let currentBranch: string | null = null;

    // ── Session Tracking ──────────────────────────────────────────────────

    pi.on("session_start", async (_event, ctx) => {
        const cwd = ctx.cwd;
        if (!(await isInsideGitRepo(cwd))) return;
        const branch = await getBranchFromCwd(cwd);
        currentBranch = branch;
    });

    pi.on("session_shutdown", async (_event, ctx) => {
        const cwd = ctx.cwd;
        const branch = currentBranch || (await getBranchFromCwd(cwd));
        currentBranch = branch;
    });

    // ── /wt-switch-create Command ─────────────────────────────────────────

    pi.registerCommand("wt-switch-create", {
        description:
            "Create or re-enter a worktrunk worktree and switch Pi into it. Usage: /wt-switch-create <branch> [<repo>] [-- <task>]",
        handler: async (args, ctx) => {
            const raw = (args || "").trim();
            if (!raw) {
                if (ctx.hasUI)
                    ctx.ui.notify(
                        "Usage: /wt-switch-create <branch> [<repo>] [-- <task>]",
                        "error",
                    );
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

            if (ctx.hasUI)
                ctx.ui.notify(`Creating worktree: ${branch}…`, "info");

            const wtArgs = ["switch", "--create", branch];
            if (repo) wtArgs.push("--repo", repo);

            try {
                await pi.exec("wt", wtArgs, { cwd: ctx.cwd });
            } catch (e) {
                if (ctx.hasUI)
                    ctx.ui.notify(`wt failed: ${errMsg(e)}`, "error");
                return;
            }

            await relaunchInWorktree(pi, ctx, branch, repo, task);
        },
    });

    // ── /wt-list Command ──────────────────────────────────────────────────

    pi.registerCommand("wt-list", {
        description:
            "Interactive worktree list — select to switch, or create new",
        handler: async (_args, ctx) => {
            const cwd = ctx.cwd;

            // Non-interactive fallback
            if (!ctx.hasUI) {
                try {
                    const result = await new Promise<string>(
                        (resolve, reject) => {
                            execFile(
                                "wt",
                                ["list"],
                                { cwd, encoding: "utf-8" },
                                (err, stdout) => {
                                    if (err) return reject(err);
                                    resolve(stdout);
                                },
                            );
                        },
                    );
                    ctx.ui.notify(result.slice(0, 500), "info");
                } catch (e) {
                    ctx.ui.notify(`wt list failed: ${errMsg(e)}`, "error");
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
                    container.addChild(
                        new Text(accent(theme.bold("Worktrees")), 1, 0),
                    );
                    container.addChild(
                        new Text(
                            dim("↑↓ select • Enter switch • Esc cancel"),
                            1,
                            0,
                        ),
                    );
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

                            const top = `╭${"─".repeat(innerW + 2)}╮`;
                            const bottom = `╰${"─".repeat(innerW + 2)}╯`;

                            const body = lines.map((line) => {
                                const vis = visibleLen(line);
                                const pad = " ".repeat(
                                    Math.max(0, innerW - vis),
                                );
                                return `│ ${line}${pad} │`;
                            });

                            return [top, ...body, bottom];
                        },
                        invalidate: () => container.invalidate(),
                        handleInput: (data) => {
                            selectList.handleInput(data);
                            tui.requestRender();
                        },
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
                },
            );

            if (!result) return; // cancelled

            // ── Create new worktree ──
            if (result === "__create__") {
                const branch = await ctx.ui.input(
                    "Branch name for new worktree",
                );
                if (!branch?.trim()) return;

                const trimmed = branch.trim();
                if (ctx.hasUI)
                    ctx.ui.notify(`Creating worktree: ${trimmed}…`, "info");

                try {
                    await pi.exec("wt", ["switch", "--create", trimmed], {
                        cwd,
                    });
                } catch (e) {
                    if (ctx.hasUI)
                        ctx.ui.notify(`wt failed: ${errMsg(e)}`, "error");
                    return;
                }

                await relaunchInWorktree(pi, ctx, trimmed);
                return;
            }

            // ── Switch to existing worktree ──
            await relaunchInWorktree(pi, ctx, result);
        },
    });

    // ── /wt-merge Command ─────────────────────────────────────────────────

    pi.registerCommand("wt-merge", {
        description:
            "Merge current worktree into a target branch. Usage: /wt-merge <target>",
        handler: async (args, ctx) => {
            const target = (args || "").trim();
            if (!target) {
                if (ctx.hasUI)
                    ctx.ui.notify(
                        "Usage: /wt-merge <target-branch>",
                        "error",
                    );
                return;
            }

            if (ctx.hasUI)
                ctx.ui.notify(`Merging into ${target}…`, "info");

            try {
                const result = await new Promise<string>((resolve, reject) => {
                    execFile(
                        "wt",
                        ["merge", target],
                        { cwd: ctx.cwd, encoding: "utf-8" },
                        (err, stdout) => {
                            if (err) return reject(err);
                            resolve(stdout);
                        },
                    );
                });
                if (ctx.hasUI) ctx.ui.notify(result.slice(0, 500), "info");
            } catch (e) {
                if (ctx.hasUI)
                    ctx.ui.notify(`Merge failed: ${errMsg(e)}`, "error");
            }
        },
    });

    // ── /wt-remove Command ─────────────────────────────────────────────────

    pi.registerCommand("wt-remove", {
        description:
            "Remove a worktree. Usage: /wt-remove [<branch>] (defaults to current branch)",
        handler: async (args, ctx) => {
            let branch = (args || "").trim();
            if (!branch) {
                branch = (await getBranchFromCwd(ctx.cwd)) || "";
            }
            if (!branch) {
                if (ctx.hasUI)
                    ctx.ui.notify(
                        "No branch specified and could not detect current branch.",
                        "error",
                    );
                return;
            }

            if (ctx.hasUI)
                ctx.ui.notify(`Removing worktree: ${branch}…`, "info");

            try {
                await pi.exec("wt", ["remove", branch], { cwd: ctx.cwd });
                if (ctx.hasUI)
                    ctx.ui.notify(`Removed worktree ${branch}.`, "info");
            } catch (e) {
                if (ctx.hasUI)
                    ctx.ui.notify(`Remove failed: ${errMsg(e)}`, "error");
            }
        },
    });

    // ── /wt-commit Command ─────────────────────────────────────────────────

    pi.registerCommand("wt-commit", {
        description:
            "Generate a commit message using LLM and commit. Usage: /wt-commit",
        handler: async (_args, ctx) => {
            if (ctx.hasUI)
                ctx.ui.notify("Running wt step commit…", "info");

            try {
                const result = await new Promise<string>((resolve, reject) => {
                    execFile(
                        "wt",
                        ["step", "commit"],
                        { cwd: ctx.cwd, encoding: "utf-8" },
                        (err, stdout) => {
                            if (err) return reject(err);
                            resolve(stdout);
                        },
                    );
                });
                if (ctx.hasUI) ctx.ui.notify(result.slice(0, 500), "info");
            } catch (e) {
                if (ctx.hasUI)
                    ctx.ui.notify(`Commit failed: ${errMsg(e)}`, "error");
            }
        },
    });

    // ── spawn_worktree_agent Tool ─────────────────────────────────────────

    pi.registerTool({
        name: "spawn_worktree_agent",
        label: "Spawn Worktree Agent",
        description:
            "Create a worktrunk worktree for a branch and spawn a Pi subagent in it. If the worktree already exists, the agent is spawned in the existing directory. Creates a herdr-managed pane for visibility.",
        parameters: Type.Object({
            branch: Type.String({
                description: "Branch name for the worktree",
            }),
            task: Type.String({
                description: "Task description for the subagent",
            }),
            repo: Type.Optional(
                Type.String({
                    description:
                        "Optional repo name (defaults to current repo)",
                }),
            ),
        }),
        async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
            const cwd = ctx.cwd;
            const branch = params.branch;
            const repo = params.repo;
            const task = params.task;

            // 1. Create worktree (use --no-cd --no-hooks to avoid cd
            // script side-effects and duplicate hooks in the subagent)
            const wtArgs = ["switch", "--create", "--no-cd", "--no-hooks", branch];
            if (repo) wtArgs.push("--repo", repo);

            try {
                await pi.exec("wt", wtArgs, { cwd });
            } catch (e) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to create worktree: ${errMsg(e)}`,
                        },
                    ],
                    details: {},
                    isError: true,
                } as unknown as AgentToolResult<unknown>;
            }

            // 2. Determine worktree path by querying git (handles custom templates)
            let worktreePath = await findWorktreePath(cwd, branch);
            if (!worktreePath) {
                const repoName = repo || path.basename(cwd);
                worktreePath = path.resolve(cwd, `../${repoName}.${branch}`);
            }

            // 3. For herdr, create a visible pane instead of a headless subprocess
            const mux = detectMultiplexer();
            if (mux === "herdr") {
                try {
                    const paneResult = await new Promise<string>((resolve, reject) => {
                        exec(
                            `herdr pane split ${process.env.HERDR_PANE_ID || ""} --direction right --no-focus`,
                            { encoding: "utf-8" },
                            (err, stdout) => {
                                if (err) return reject(err);
                                resolve(stdout);
                            },
                        );
                    });

                    let newPaneId: string | undefined;
                    try {
                        const parsed = JSON.parse(paneResult);
                        newPaneId = parsed.result?.pane?.pane_id;
                    } catch {
                        // ignore
                    }

                    if (!newPaneId) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `Created worktree but could not create herdr pane.`,
                                },
                            ],
                            details: {},
                            isError: true,
                        } as unknown as AgentToolResult<unknown>;
                    }

                    const cmd = `cd ${worktreePath} && pi --no-session '${task.replace(/'/g, "'\\''")}'`;
                    await pi.exec("herdr", ["pane", "run", newPaneId, cmd]);

                    return {
                        content: [
                            {
                                type: "text",
                                text: `Spawned subagent in worktree ${branch} (pane ${newPaneId}). Use \`herdr wait agent-status ${newPaneId} --status done\` to coordinate.`,
                            },
                        ],
                        details: { paneId: newPaneId, worktreePath },
                        isError: false,
                    } as unknown as AgentToolResult<unknown>;
                } catch (e) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Failed to spawn in herdr pane: ${errMsg(e)}`,
                            },
                        ],
                        details: {},
                        isError: true,
                    } as unknown as AgentToolResult<unknown>;
                }
            }

            // 4. Fallback: headless subprocess for non-herdr multiplexers
            const subagentArgs = [
                "--mode",
                "json",
                "-p",
                "--no-session",
                `--cwd`,
                worktreePath,
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
                proc.stdout.on("data", (d: Buffer) => {
                    stdout += d.toString();
                });
                proc.stderr.on("data", (d: Buffer) => {
                    stderr += d.toString();
                });

                proc.on("close", (code) => {
                    const exitCode = code ?? 1;

                    const lastMessage = stdout
                        .split("\n")
                        .filter(Boolean)
                        .map((line: string) => {
                            try {
                                return JSON.parse(line);
                            } catch {
                                return null;
                            }
                        })
                        .filter(
                            (e): e is JournalEntry =>
                                e != null &&
                                typeof e === "object" &&
                                (e as JournalEntry).type === "message_end" &&
                                (e as JournalEntry).message?.role ===
                                    "assistant",
                        )
                        .pop();

                    const output =
                        lastMessage?.message?.content?.[0]?.text ||
                        stdout.slice(-500) ||
                        "(no output)";

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
                    } as unknown as AgentToolResult<unknown>);
                });

                proc.on("error", (err) => {
                    resolve({
                        content: [
                            {
                                type: "text",
                                text: `Failed to spawn subagent: ${err.message}`,
                            },
                        ],
                        details: {},
                        isError: true,
                    } as unknown as AgentToolResult<unknown>);
                });
            });
        },
    });
}

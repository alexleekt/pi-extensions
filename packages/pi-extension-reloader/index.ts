import { homedir, tmpdir } from "node:os";
import {
    readdirSync,
    statSync,
    unlinkSync,
    existsSync,
    readFileSync,
} from "node:fs";
import { dirname, join, basename } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

/* ── Jiti cache discovery ─────────────────────────────────────────── */

const JITI_CACHE_CANDIDATES = [
    join(tmpdir(), "jiti"),
    "/tmp/jiti",
    "/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/.cache/jiti",
];

function findJitiCacheDir(): string | undefined {
    const envCache = process.env.JITI_FS_CACHE;
    if (envCache && envCache !== "false" && existsSync(envCache)) {
        return envCache;
    }

    for (const candidate of JITI_CACHE_CANDIDATES) {
        if (existsSync(candidate) && statSync(candidate).isDirectory()) {
            return candidate;
        }
    }

    // Deep scan tmpdir for jiti-style .mjs directories
    try {
        for (const entry of readdirSync(tmpdir())) {
            const fullPath = join(tmpdir(), entry);
            try {
                if (!statSync(fullPath).isDirectory()) continue;
                const files = readdirSync(fullPath);
                const sample = files.find((f) => f.endsWith(".mjs"));
                if (
                    sample &&
                    readFileSync(join(fullPath, sample), "utf-8").includes(
                        "jitiImport",
                    )
                ) {
                    return fullPath;
                }
            } catch { /* ignore */ }
        }
    } catch { /* ignore */ }

    return undefined;
}

/* ── Cache file matching ───────────────────────────────────────────── */

function findExtensionCacheFiles(
    cacheDir: string,
    extName: string,
): string[] {
    const files: string[] = [];
    const searchTerm = extName.toLowerCase();
    try {
        for (const entry of readdirSync(cacheDir)) {
            if (!entry.endsWith(".mjs")) continue;
            const fullPath = join(cacheDir, entry);

            // Filename heuristic (keep dashes in search)
            if (entry.toLowerCase().includes(searchTerm)) {
                files.push(fullPath);
                continue;
            }

            // Content heuristic
            try {
                const head = readFileSync(fullPath, "utf-8").slice(0, 2000);
                if (head.includes(extName)) files.push(fullPath);
            } catch { /* ignore */ }
        }
    } catch { /* ignore */ }
    return files;
}

/* ── Extension path resolution ────────────────────────────────────── */

function resolveExtensionPath(nameOrPath: string): string | undefined {
    // Absolute path — use as-is
    if (nameOrPath.startsWith("/") || nameOrPath.startsWith("~")) {
        const expanded = nameOrPath.startsWith("~")
            ? join(homedir(), nameOrPath.slice(1))
            : nameOrPath;
        if (existsSync(expanded)) return expanded;
        return undefined;
    }

    // Relative/s bare name — MUST be a safe bare identifier (no path traversal)
    if (/[./\\]/.test(nameOrPath)) {
        return undefined; // Reject paths with separators or dot segments
    }

    const base = join(homedir(), ".pi", "agent", "extensions");
    const directPath = join(base, nameOrPath);
    if (existsSync(directPath)) {
        const stat = statSync(directPath);
        if (stat.isDirectory() && existsSync(join(directPath, "index.ts"))) {
            return directPath;
        }
        if (stat.isFile() && directPath.endsWith(".ts")) {
            return directPath;
        }
    }

    const indexPath = join(base, nameOrPath, "index.ts");
    if (existsSync(indexPath)) return join(base, nameOrPath);

    return undefined;
}

/* ── Local vs npm safety guard ─────────────────────────────────────── */

function isLocalExtension(extPath: string): boolean {
    const normalized = extPath.replace(/\\/g, "/");
    // node_modules packages are managed by npm/git — don't rebuild them
    if (normalized.includes("/node_modules/")) return false;

    // Anything under ~/.pi/agent/extensions/ is local (symlink or real directory)
    const localBase = join(homedir(), ".pi", "agent", "extensions").replace(
        /\\/g,
        "/",
    );
    if (normalized.startsWith(localBase)) return true;

    // Absolute paths passed explicitly are treated as local
    return true;
}

/* ── Webview rebuild helper ─────────────────────────────────────────── */

async function rebuildWebview(
    extPath: string,
    ctx: ExtensionCommandContext,
): Promise<boolean> {
    // If user passed a file path, resolve to its containing directory
    const dir = extPath.endsWith(".ts") && !statSync(extPath).isDirectory()
        ? dirname(extPath)
        : extPath;

    const pkgJsonPath = join(dir, "package.json");
    if (!existsSync(pkgJsonPath)) {
        ctx.ui.notify(
            `No package.json in ${basename(dir)} — skipping rebuild`,
            "warning",
        );
        return false;
    }

    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    const hasWebviewBuild = pkg.scripts?.["build:webview"];
    const hasBuild = pkg.scripts?.build;

    if (!hasBuild && !hasWebviewBuild) {
        ctx.ui.notify(
            `No build script in ${basename(dir)} — skipping rebuild`,
            "warning",
        );
        return false;
    }

    const cmd = hasWebviewBuild ? "npm run build:webview" : "npm run build";
    ctx.ui.notify(`Rebuilding ${basename(dir)}…`, "info");

    try {
        const { exec } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execAsync = promisify(exec);
        await execAsync(cmd, {
            cwd: dir,
            maxBuffer: 10 * 1024 * 1024, // 10 MB buffer for verbose builds
        });
        ctx.ui.notify(`✓ ${basename(dir)} rebuilt`, "info");
        return true;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Build failed: ${msg}`, "error");
        return false;
    }
}

/* ── Main extension ─────────────────────────────────────────────────── */

export default function (pi: ExtensionAPI) {
    pi.registerCommand("rebuild-extension", {
        description:
            "Rebuild a local extension's webview, clear its jiti cache, and reload the Pi runtime.",
        getArgumentCompletions: (prefix: string) => {
            const base = join(homedir(), ".pi", "agent", "extensions");
            try {
                const entries = readdirSync(base)
                    .filter((e) => {
                        const p = join(base, e);
                        try {
                            return (
                                statSync(p).isSymbolicLink() ||
                                statSync(p).isDirectory() ||
                                p.endsWith(".ts")
                            );
                        } catch {
                            return false;
                        }
                    })
                    .filter((e) =>
                        e.toLowerCase().startsWith(prefix.toLowerCase()),
                    );
                return entries.map((e) => ({ value: e, label: e }));
            } catch {
                return null;
            }
        },
        handler: async (args, ctx) => {
            if (!args.trim()) {
                ctx.ui.notify(
                    "Usage: /rebuild-extension <name>",
                    "warning",
                );
                return;
            }

            const extName = args.trim().split(/\s+/)[0];
            const extPath = resolveExtensionPath(extName);
            if (!extPath) {
                ctx.ui.notify(
                    `Extension "${extName}" not found`,
                    "error",
                );
                return;
            }

            const local = isLocalExtension(extPath);
            const startTime = Date.now();

            // Persist rebuild start so it survives the reload
            pi.appendEntry("rebuild-status", {
                extension: basename(extPath),
                state: "rebuilding",
                timestamp: startTime,
            });

            // ── Clear jiti cache (always, for any extension type) ──
            const cacheDir = findJitiCacheDir();
            let clearedCount = 0;
            let remainingCount = 0;
            if (cacheDir) {
                const files = findExtensionCacheFiles(cacheDir, basename(extPath));
                if (files.length > 0) {
                    for (const f of files) {
                        try {
                            unlinkSync(f);
                            clearedCount++;
                        } catch { /* ignore */ }
                    }
                    // Verify deletion — check if any matched files still exist
                    const remaining = files.filter((f) => existsSync(f));
                    remainingCount = remaining.length;
                    if (remainingCount > 0) {
                        ctx.ui.notify(
                            `Cache clear incomplete: ${remainingCount} file(s) could not be deleted. Changes may not take effect.`,
                            "warning",
                        );
                    } else if (clearedCount > 0) {
                        ctx.ui.notify(
                            `Cleared ${clearedCount} jiti cache file(s)`,
                            "info",
                        );
                    }
                }
            } else {
                ctx.ui.notify(
                    "Could not find jiti cache directory. Try restarting Pi, or set JITI_FS_CACHE env var.",
                    "warning",
                );
            }

            // ── Rebuild (local only) ──
            let rebuilt = false;
            if (local) {
                rebuilt = await rebuildWebview(extPath, ctx);
            } else {
                ctx.ui.notify(
                    `${basename(extPath)} is an npm package — skipping rebuild. Jiti cache cleared.`,
                    "info",
                );
            }

            // Persist completion status (survives reload)
            pi.appendEntry("rebuild-status", {
                extension: basename(extPath),
                state: rebuilt ? "rebuilt" : "cache-cleared-only",
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
            });

            // ── Reload Pi runtime ──
            await ctx.reload();
            // After reload returns, future commands/events use the new version
        },
    });
}

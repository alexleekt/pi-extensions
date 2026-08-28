// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
    mkdtemp,
    readdir,
    readFile,
    realpath,
    rename,
    rm,
    stat,
    writeFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import type {
    ExtensionAPI,
    ExtensionCommandContext,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const execFileAsync = promisify(execFile);

const REQUIRED_FIELDS = [
    "id",
    "package",
    "baseVersion",
    "baseHash",
    "patch",
    "intent",
    "reason",
    "enabled",
] as const;
const OPTIONAL_FIELDS = [
    "target",
    "validation",
    "upstream",
    "createdWith",
] as const;
const FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const;

export interface Manifest {
    id: string;
    package: string;
    baseVersion: string;
    baseHash: string;
    patch: string;
    intent: string;
    reason: string;
    enabled: boolean;
    target?: { file: string; symbol?: string; change: string };
    validation?: string;
    upstream?: { status: string; url: string };
    createdWith?: { provider: string; model: string };
}
export interface PackageInfo {
    name: string;
    version: string;
    root: string;
    patchDir?: string;
}
export interface Discovery {
    patches: string[];
    invalid: string[];
}
export type PatchStatus =
    | "missing"
    | "clean"
    | "applied"
    | "drifted"
    | "failed";

function fail(message: string): never {
    throw new Error(`Invalid patch manifest: ${message}`);
}
function npmName(value: string): boolean {
    return /^(?:@[a-z0-9][a-z0-9._~-]*\/[a-z0-9][a-z0-9._~-]*|[a-z0-9][a-z0-9._~-]*)$/.test(
        value,
    );
}

/** True when `child` is `root` itself or lies beneath it (lexical check on resolved paths). */
function contained(root: string, child: string): boolean {
    const r = relative(root, child);
    return (
        r === "" || (r !== ".." && !r.startsWith(`..${sep}`) && !isAbsolute(r))
    );
}

/** Reject paths that escape their base: absolute, backslash-encoded, `..`, or unsafe empties. */
function safeRelative(value: string, what: string): string {
    if (isAbsolute(value)) fail(`${what} must not be an absolute path`);
    if (value !== value.replaceAll("\\", "/"))
        fail(`${what} must use forward slashes`);
    const parts = value.split("/");
    if (parts.includes("..") || parts.includes(".") || parts.includes(""))
        fail(`${what} must not contain traversal or empty segments`);
    return value;
}

function validateOptionalFields(object: Record<string, unknown>): void {
    if (object.target !== undefined) {
        const target = object.target as Record<string, unknown>;
        if (
            typeof target !== "object" ||
            target === null ||
            Array.isArray(target)
        )
            fail("target must be an object");
        for (const key of Object.keys(target))
            if (!["file", "symbol", "change"].includes(key))
                fail(`unknown field 'target.${key}'`);
        if (typeof target.file !== "string" || !target.file)
            fail("target.file must be a non-empty string");
        if (typeof target.change !== "string" || !target.change)
            fail("target.change must be a non-empty string");
        safeRelative(target.file, "target.file");
        if (
            target.symbol !== undefined &&
            (typeof target.symbol !== "string" || !target.symbol)
        )
            fail("target.symbol must be a non-empty string when present");
    }
    if (object.validation !== undefined) {
        if (typeof object.validation !== "string" || !object.validation)
            fail("validation must be a non-empty string when present");
        safeRelative(object.validation, "validation");
    }
    if (object.upstream !== undefined) {
        const upstream = object.upstream as Record<string, unknown>;
        if (
            typeof upstream !== "object" ||
            upstream === null ||
            Array.isArray(upstream)
        )
            fail("upstream must be an object");
        for (const key of Object.keys(upstream))
            if (!["status", "url"].includes(key))
                fail(`unknown field 'upstream.${key}'`);
        if (
            typeof upstream.status !== "string" ||
            !/^[a-z][a-z0-9-]*$/.test(upstream.status)
        )
            fail("upstream.status must be a lowercase kebab-case string");
        if (typeof upstream.url !== "string")
            fail("upstream.url must be a string");
        if (upstream.url && !/^https?:\/\//.test(upstream.url))
            fail("upstream.url must be an http(s) URL when non-empty");
    }
    if (object.createdWith !== undefined) {
        const provenance = object.createdWith as Record<string, unknown>;
        if (
            typeof provenance !== "object" ||
            provenance === null ||
            Array.isArray(provenance)
        )
            fail("createdWith must be an object");
        for (const key of Object.keys(provenance))
            if (!["provider", "model"].includes(key))
                fail(`unknown field 'createdWith.${key}'`);
        if (typeof provenance.provider !== "string" || !provenance.provider)
            fail(
                "createdWith.provider must be a non-empty string when present",
            );
        if (typeof provenance.model !== "string" || !provenance.model)
            fail("createdWith.model must be a non-empty string when present");
    }
}

export async function discoverPatchDirs(
    patchesRoot: string,
): Promise<Discovery> {
    const patches: string[] = [],
        invalid: string[] = [];
    try {
        for (const entry of await readdir(patchesRoot, {
            withFileTypes: true,
        })) {
            if (!entry.isDirectory()) continue;
            const dir = join(patchesRoot, entry.name);
            try {
                await stat(join(dir, "manifest.json"));
                patches.push(dir);
            } catch {
                invalid.push(dir);
            }
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return { patches: patches.sort(), invalid: invalid.sort() };
}

export async function readManifest(manifestPath: string): Promise<Manifest> {
    let value: unknown;
    try {
        value = JSON.parse(await readFile(manifestPath, "utf8"));
    } catch (error) {
        fail(
            `cannot parse ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
        fail("root must be an object");
    const object = value as Record<string, unknown>;
    for (const key of Object.keys(object))
        if (!(FIELDS as readonly string[]).includes(key))
            fail(`unknown field '${key}'`);
    for (const key of REQUIRED_FIELDS)
        if (!(key in object)) fail(`missing required field '${key}'`);
    if (
        typeof object.id !== "string" ||
        !/^[a-z0-9][a-z0-9-]*$/.test(object.id)
    )
        fail("id must match ^[a-z0-9][a-z0-9-]*$");
    if (typeof object.package !== "string" || !npmName(object.package))
        fail("package is not a valid npm package name");
    if (typeof object.baseVersion !== "string" || !object.baseVersion)
        fail("baseVersion must be non-empty");
    if (
        typeof object.baseHash !== "string" ||
        !/^sha256:[0-9a-f]{64}$/.test(object.baseHash)
    )
        fail(
            "baseHash must be sha256: followed by 64 lowercase hex characters",
        );
    if (typeof object.patch !== "string" || !object.patch.startsWith("patch/"))
        fail("patch must be a safe relative path under patch/");
    safeRelative(object.patch, "patch");
    if (typeof object.intent !== "string" || !object.intent)
        fail("intent must be non-empty");
    if (typeof object.reason !== "string" || !object.reason)
        fail("reason must be non-empty");
    if (typeof object.enabled !== "boolean") fail("enabled must be boolean");
    validateOptionalFields(object);
    return object as unknown as Manifest;
}

/** Resolve the patch file for a patch directory, rejecting symlink escapes.
 *  Returns the contained absolute path. Throws with an actionable message otherwise. */
export async function resolvePatchPath(
    dir: string,
    patchRel: string,
): Promise<string> {
    const patchPath = join(dir, patchRel);
    const [realDir, realPatch] = await Promise.all([
        realpath(dir),
        realpath(patchPath),
    ]);
    if (!contained(realDir, realPatch))
        throw new Error(`Patch file escapes patch directory: ${realPatch}`);
    return realPatch;
}

export async function resolvePackage(
    packageName: string,
    roots: string[],
): Promise<PackageInfo> {
    if (!npmName(packageName))
        throw new Error(
            `Cannot resolve invalid npm package name '${packageName}'`,
        );
    for (const root of roots) {
        const candidate = resolve(
            root,
            "node_modules",
            ...packageName.split("/"),
        );
        try {
            const packageRoot = await realpath(candidate),
                allowed = await realpath(root);
            if (!contained(allowed, packageRoot)) continue;
            const json = JSON.parse(
                await readFile(join(packageRoot, "package.json"), "utf8"),
            ) as Record<string, unknown>;
            if (json.name !== packageName || typeof json.version !== "string")
                throw new Error(`package identity mismatch at ${packageRoot}`);
            return {
                name: packageName,
                version: json.version,
                root: packageRoot,
            };
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.includes("identity mismatch")
            )
                throw error;
        }
    }
    throw new Error(
        `Package '${packageName}' was not found in allowed node_modules roots`,
    );
}

async function files(root: string, dir = root): Promise<string[]> {
    const result: string[] = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isSymbolicLink())
            throw new Error(`symlink rejected: ${path}`);
        if (entry.isDirectory()) result.push(...(await files(root, path)));
        else if (entry.isFile())
            result.push(relative(root, path).split(sep).join("/"));
    }
    return result.sort();
}

/** SHA-256 over the package's regular files in sorted POSIX-relative-path order.
 *  The input root is realpathed first so a symlinked root cannot alias another tree. */
export async function hashPackage(packageRoot: string): Promise<string> {
    const root = await realpath(packageRoot);
    const stats = await stat(root);
    if (!stats.isDirectory())
        throw new Error(`Not a directory: ${packageRoot}`);
    const hash = createHash("sha256");
    for (const path of await files(root)) {
        const bytes = await readFile(join(root, path));
        hash.update(path)
            .update("\0")
            .update(String(bytes.byteLength))
            .update("\0")
            .update(bytes);
    }
    return `sha256:${hash.digest("hex")}`;
}

export async function gitDryRun(
    patchPath: string,
    packageRoot: string,
    reverse = false,
): Promise<void> {
    const args = [
        "apply",
        "--check",
        ...(reverse ? ["--reverse"] : []),
        `--directory=${packageRoot}`,
        "--whitespace=error",
        patchPath,
    ];
    await execFileAsync("git", args);
}

export async function getPatchStatus(
    manifest: Manifest,
    pkg?: PackageInfo,
): Promise<PatchStatus> {
    if (!pkg?.patchDir) return "missing";
    try {
        // Patch file must exist and stay inside its patch directory (no symlink escapes).
        const patchPath = await resolvePatchPath(pkg.patchDir, manifest.patch);
        const current = await hashPackage(pkg.root);
        // A different version is drift, even if the old patch still reverse-applies.
        if (pkg.version !== manifest.baseVersion) return "drifted";
        if (current === manifest.baseHash) return "clean";
        // Same version but different content: the patch may or may not be present.
        try {
            await gitDryRun(patchPath, pkg.root, true);
            return "applied";
        } catch {
            return "drifted";
        }
    } catch {
        return "failed";
    }
}

interface Entry {
    manifest: Manifest;
    dir: string;
    status: PatchStatus;
    package?: PackageInfo;
    error?: string;
}

async function registry(agentDir: string, roots: string[]): Promise<Entry[]> {
    const found = await discoverPatchDirs(join(agentDir, "patches"));
    const entries: Entry[] = [];
    for (const dir of found.patches) {
        try {
            const manifest = await readManifest(join(dir, "manifest.json"));
            let pkg: PackageInfo | undefined;
            let status: PatchStatus = "missing";
            try {
                const _patchPath = await resolvePatchPath(dir, manifest.patch);
                try {
                    pkg = await resolvePackage(manifest.package, roots);
                } catch {
                    pkg = undefined;
                }
                if (pkg) {
                    pkg.patchDir = dir;
                    status = await getPatchStatus(manifest, pkg);
                }
            } catch (error) {
                status = "failed";
                entries.push({
                    manifest,
                    dir,
                    status,
                    error:
                        error instanceof Error ? error.message : String(error),
                });
                continue;
            }
            entries.push({ manifest, dir, package: pkg, status });
        } catch (error) {
            entries.push({
                manifest: {
                    id: "",
                    package: "",
                    baseVersion: "",
                    baseHash: "",
                    patch: "",
                    intent: "",
                    reason: "",
                    enabled: false,
                },
                dir,
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    return entries;
}

function output(ctx: ExtensionCommandContext, text: string): void {
    ctx.ui.notify(text, "info");
}
function describe(entry: Entry): string {
    const m = entry.manifest;
    return [
        `${m.id || entry.dir}`,
        `package: ${m.package || "?"}`,
        `base: ${m.baseVersion || "?"} ${m.baseHash || "?"}`,
        `intent: ${m.intent || "?"}`,
        m.reason ? `reason: ${m.reason}` : "",
        m.target
            ? `target: ${m.target.file}${m.target.change ? ` — ${m.target.change}` : ""}`
            : "",
        m.upstream
            ? `upstream: ${m.upstream.status}${m.upstream.url ? ` (${m.upstream.url})` : ""}`
            : "",
        entry.error ? `error: ${entry.error}` : "",
        `enabled: ${m.enabled}`,
        `status: ${entry.status}`,
    ]
        .filter(Boolean)
        .join("\n");
}

const HELP =
    "Patch manager commands:\n  /patch list              List registered patches\n  /patch status            Show patch status\n  /patch explain <id>      Explain a patch\n  /patch disable <id>      Disable a patch\n  /patch help              Show this help\n\nTo create a managed patch, use /skill:patch-creator.\nApply and rebase are unavailable in v0.1.";

export default async function patchManager(pi: ExtensionAPI) {
    pi.registerCommand("patch", {
        description: "Inspect and manage package patches",
        handler: async (args: string, ctx: ExtensionCommandContext) => {
            const [sub, id] = args.trim().split(/\s+/, 2);
            const agentDir = process.env.PI_AGENT_DIR || getAgentDir();
            const roots = [agentDir, join(agentDir, "extensions"), ctx.cwd];
            const entries = await registry(agentDir, roots);
            const entry = id
                ? entries.find((x) => x.manifest.id === id)
                : undefined;

            if (!sub || sub === "help") return output(ctx, HELP);

            if (sub === "list")
                return output(
                    ctx,
                    entries
                        .map(
                            (x) =>
                                `${x.manifest.id || x.dir} ${x.manifest.package || "?"} enabled=${x.manifest.enabled ? "yes" : "no"} status=${x.status}${x.error ? ` (${x.error})` : ""}`,
                        )
                        .join("\n") || "No patches found.",
                );

            if (sub === "status") {
                const lines = entries.map(
                    (x) =>
                        `${x.manifest.id || x.dir}: ${x.status}${x.package ? ` (${x.package.version})` : ""}${x.error ? ` — ${x.error}` : ""}`,
                );
                return output(ctx, lines.join("\n") || "No patches found.");
            }

            if (sub === "explain")
                return output(
                    ctx,
                    entry
                        ? describe(entry)
                        : `Patch '${id || ""}' was not found.`,
                );

            if (sub === "disable") {
                if (!id || !entry)
                    return output(ctx, `Patch '${id || ""}' was not found.`);
                if (!entry.manifest.enabled)
                    return output(ctx, `Patch ${id} is already disabled.`);
                const manifestPath = join(entry.dir, "manifest.json");
                // Write via a random temp directory inside the patch dir, then rename:
                // unpredictable path defeats symlink pre-planting, rename is atomic on the same filesystem.
                const tempDir = await mkdtemp(join(entry.dir, ".disable-"));
                try {
                    const temp = join(tempDir, "manifest.json");
                    await writeFile(
                        temp,
                        `${JSON.stringify({ ...entry.manifest, enabled: false }, null, 4)}\n`,
                        { mode: 0o600 },
                    );
                    await rename(temp, manifestPath);
                } finally {
                    await rm(tempDir, { recursive: true, force: true });
                }
                return output(ctx, `Disabled patch ${id}.`);
            }

            if (sub === "apply")
                return output(
                    ctx,
                    "Patch application is not available in v0.1. No files were changed.",
                );
            if (sub === "rebase")
                return output(
                    ctx,
                    "Patch rebasing is not available in v0.1. No files were changed.",
                );
            output(ctx, HELP);
        },
    });

    pi.registerTool({
        name: "patch_status",
        label: "Patch status",
        description: "Read-only package patch registry status",
        parameters: Type.Object({}),
        execute: async (
            _toolCallId,
            _params,
            _signal,
            _onUpdate,
            ctx: ExtensionContext,
        ) => {
            const agentDir = process.env.PI_AGENT_DIR || getAgentDir();
            const roots = [agentDir, join(agentDir, "extensions"), ctx.cwd];
            const entries = await registry(agentDir, roots);
            return {
                content: [
                    { type: "text", text: JSON.stringify(entries, null, 2) },
                ],
                details: {},
            };
        },
    });
}

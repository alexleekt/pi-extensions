#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Alex Lee
// Helper for the patch-creator skill. Imports the extension's own logic so
// hashes and patch formats are always identical to what the registry expects.
//
// Usage:
//   node create-patch.mjs hash <packageRoot>
//   node create-patch.mjs create <patchId> <pristineDir> <editedDir> [patchesRoot]

import { execFile } from "node:child_process";
import { mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { hashPackage } from "../../../index.ts";

const execFileAsync = promisify(execFile);
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

function usage() {
    console.error(
        "Usage:\n  node create-patch.mjs hash <packageRoot>\n  node create-patch.mjs create <patchId> <pristineDir> <editedDir> [patchesRoot]",
    );
    process.exit(2);
}

async function gitDiff(pristine, edited) {
    try {
        // Run from / so git prints absolute paths, making the prefix strip deterministic.
        const { stdout } = await execFileAsync(
            "git",
            ["diff", "--no-index", "--binary", "--no-prefix", pristine, edited],
            { cwd: "/" },
        );
        return stdout;
    } catch (error) {
        // git exits 1 when differences are found; stdout still carries the diff.
        const stdout = error.stdout;
        if (typeof stdout === "string" && stdout.length > 0) return stdout;
        throw error;
    }
}

const [mode, ...args] = process.argv.slice(2);
if (mode === "hash") {
    const packageRoot = args[0];
    if (!packageRoot) usage();
    console.log(
        JSON.stringify({ baseHash: await hashPackage(resolve(packageRoot)) }),
    );
} else if (mode === "create") {
    const [id, pristineArg, editedArg, patchesRootArg] = args;
    if (!id || !pristineArg || !editedArg) usage();
    if (!ID_RE.test(id)) {
        console.error(`Patch id '${id}' must match ${ID_RE.source}`);
        process.exit(2);
    }
    const pristine = await realpath(resolve(pristineArg));
    const edited = await realpath(resolve(editedArg));
    if (pristine === edited) {
        console.error(
            "pristineDir and editedDir must be different directories",
        );
        process.exit(2);
    }
    const diff = await gitDiff(pristine, edited);
    if (!diff.trim()) {
        console.error(
            "No differences between pristineDir and editedDir — nothing to patch.",
        );
        process.exit(1);
    }
    // Paths must be relative to the package root with a/ b/ prefixes (git apply's
    // default -p1 strips them). Rewrite only header lines so content is untouched.
    const rel = (p) => p.replace(/^\/+/, "");
    const pb = rel(pristine),
        eb = rel(edited);
    const relativeDiff = diff
        .split("\n")
        .map((line) => {
            if (line.startsWith(`diff --git ${pb}/`))
                return line
                    .replace(`diff --git ${pb}/`, "diff --git a/")
                    .replace(` ${eb}/`, " b/");
            if (line.startsWith(`--- ${pb}/`))
                return `--- a/${line.slice(4 + pb.length + 1)}`;
            if (line.startsWith(`+++ ${eb}/`))
                return `+++ b/${line.slice(4 + eb.length + 1)}`;
            if (line.startsWith(`rename from ${pb}/`))
                return `rename from a/${line.slice(12 + pb.length + 1)}`;
            if (line.startsWith(`rename to ${eb}/`))
                return `rename to b/${line.slice(11 + eb.length + 1)}`;
            return line;
        })
        .join("\n");
    if (relativeDiff.includes(pristine) || relativeDiff.includes(edited)) {
        console.error(
            "Patch still contains absolute paths after prefix stripping; aborting.",
        );
        process.exit(1);
    }
    const patchesRoot = patchesRootArg
        ? resolve(patchesRootArg)
        : join(homedir(), ".pi", "agent", "patches");
    const patchFile = join(patchesRoot, id, "patch", `${id}.patch`);
    await mkdir(join(patchesRoot, id, "patch"), {
        recursive: true,
        mode: 0o700,
    });
    await writeFile(patchFile, relativeDiff, { mode: 0o600 });
    // Self-verify before declaring success: the patch must forward-apply to the
    // pristine tree and reverse-apply to the edited tree, from the trees themselves
    // (repository-neutral cwd, same as the extension's engine). Catches degenerate
    // or quoted-path headers that would silently no-op under git apply.
    const verify = (dir, extra) =>
        execFileAsync(
            "git",
            ["apply", "--no-index", "--check", ...(extra ?? []), patchFile],
            {
                cwd: dir,
                env: Object.fromEntries(
                    Object.entries(process.env).filter(
                        ([k]) => !k.startsWith("GIT_"),
                    ),
                ),
            },
        );
    try {
        await verify(pristine);
        await verify(edited, ["--reverse"]);
    } catch (error) {
        console.error(
            "Patch does not verify against the snapshot trees; aborting.\n" +
                (error.stderr || error.message || ""),
        );
        await rm(join(patchesRoot, id), { recursive: true, force: true });
        process.exit(1);
    }
    console.log(
        JSON.stringify({
            id,
            patchFile,
            baseHash: await hashPackage(pristine),
            next: `Write ${join(patchesRoot, id, "manifest.json")} with id=${id}, patch="patch/${id}.patch", this baseHash, and your intent/reason. Verify with: git apply --check --reverse --directory=<pkg root> ${patchFile}`,
        }),
    );
} else {
    usage();
}

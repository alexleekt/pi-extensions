import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    symlink,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
    applyPatch,
    discoverPatchDirs,
    getPatchStatus,
    hashPackage,
    readManifest,
    resolvePackage,
    resolvePatchPath,
} from "./index.ts";

const execFileAsync = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), "pi-patch-manager-"));

/** Generate a unified diff with proper a/ b/ prefixes (git apply's default -p1 strip),
 *  matching the create-patch.mjs header-rewrite logic. */
const craftDiff = async (pristine, edited) => {
    const diff = await execFileAsync(
        "git",
        ["diff", "--no-index", "--binary", "--no-prefix", pristine, edited],
        { cwd: "/" },
    ).then((r) => r.stdout, (e) => e.stdout ?? "");
    // cwd "/" makes git print paths relative to / without the leading slash.
    const pb = pristine.replace(/^\/+/, "");
    const eb = edited.replace(/^\/+/, "");
    return diff
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
            return line;
        })
        .join("\n");
};

const manifest = {
    id: "demo",
    package: "demo",
    baseVersion: "1.0.0",
    baseHash: `sha256:${"a".repeat(64)}`,
    patch: "patch/demo.patch",
    intent: "test",
    reason: "testing",
    enabled: true,
};

try {
    // ── discovery ──
    const patches = join(root, "patches");
    await mkdir(join(patches, "good", "patch"), { recursive: true });
    await writeFile(
        join(patches, "good", "manifest.json"),
        JSON.stringify(manifest),
    );
    await writeFile(
        join(patches, "good", "patch", "demo.patch"),
        "not a real patch",
    );
    await mkdir(join(patches, "bad"));
    const discovery = await discoverPatchDirs(patches);
    assert.deepEqual(discovery.patches, [join(patches, "good")]);
    assert.deepEqual(discovery.invalid, [join(patches, "bad")]);

    // ── manifest parsing ──
    assert.deepEqual(
        await readManifest(join(patches, "good", "manifest.json")),
        manifest,
    );
    await writeFile(join(root, "bad.json"), "{");
    await assert.rejects(readManifest(join(root, "bad.json")), /cannot parse/);
    const optionalManifest = {
        ...manifest,
        target: {
            file: "dist/index.ts",
            symbol: "DEFAULT_SERVER_CONFIGS",
            change: "Add fish route",
        },
        validation: "checks.sh",
        upstream: { status: "not-submitted", url: "" },
        createdWith: { provider: "openai-codex", model: "gpt-5.6-luna" },
    };
    assert.deepEqual(
        await readManifest(
            await writeFile(
                join(root, "optional.json"),
                JSON.stringify(optionalManifest),
            ).then(() => join(root, "optional.json")),
        ),
        optionalManifest,
    );
    const badManifests = [
        { ...manifest, enabled: "yes" }, // wrong type
        { ...manifest, extra: 1 }, // unknown field
        { ...manifest, patch: "/tmp/a" }, // absolute path
        { ...manifest, patch: "patch/../x" }, // traversal
        { ...manifest, patch: "other/x.patch" }, // not under patch/
        { ...manifest, reason: undefined }, // missing new required field
        { ...manifest, target: { file: "/abs", change: "x" } }, // target absolute path
        { ...manifest, target: { file: "a/../b", change: "x" } }, // target traversal
        { ...manifest, target: { file: "a.ts", change: "x", extra: 1 } }, // unknown target field
        { ...manifest, validation: "../evil.sh" }, // validation traversal
        { ...manifest, upstream: { status: "Not Valid", url: "" } }, // bad status
        { ...manifest, upstream: { status: "ok", url: "javascript:alert(1)" } }, // bad url
        { ...manifest, createdWith: { provider: "", model: "m" } }, // empty provider
    ];
    for (const [i, bad] of badManifests.entries()) {
        const p = join(root, `bad-${i}.json`);
        await writeFile(p, JSON.stringify(bad));
        await assert.rejects(
            readManifest(p),
            undefined,
            `expected rejection for case ${i}: ${JSON.stringify(bad)}`,
        );
    }

    // ── package resolution ──
    await mkdir(join(root, "node_modules", "demo"), { recursive: true });
    await writeFile(
        join(root, "node_modules", "demo", "package.json"),
        JSON.stringify({ name: "demo", version: "1.0.0" }),
    );
    assert.equal((await resolvePackage("demo", [root])).version, "1.0.0");
    await mkdir(join(root, "node_modules", "@scope", "pkg"), {
        recursive: true,
    });
    await writeFile(
        join(root, "node_modules", "@scope", "pkg", "package.json"),
        JSON.stringify({ name: "@scope/pkg", version: "2.0.0" }),
    );
    assert.equal(
        (await resolvePackage("@scope/pkg", [root])).name,
        "@scope/pkg",
    );
    await assert.rejects(resolvePackage("missing", [root]), /not found/);
    await writeFile(
        join(root, "node_modules", "demo", "package.json"),
        JSON.stringify({ name: "other", version: "1.0.0" }),
    );
    await assert.rejects(resolvePackage("demo", [root]), /identity mismatch/);
    await writeFile(
        join(root, "node_modules", "demo", "package.json"),
        JSON.stringify({ name: "demo", version: "1.0.0" }),
    );

    // ── hashing ──
    const pkgRoot = join(root, "node_modules", "demo");
    const hash1 = await hashPackage(pkgRoot);
    assert.match(hash1, /^sha256:[0-9a-f]{64}$/);
    const hash2 = await hashPackage(pkgRoot);
    assert.equal(hash1, hash2, "hash must be deterministic");
    await writeFile(join(pkgRoot, "extra.txt"), "changed");
    assert.notEqual(
        await hashPackage(pkgRoot),
        hash1,
        "hash must change with content",
    );
    await rm(join(pkgRoot, "extra.txt"));
    await symlink("/etc", join(pkgRoot, "escaped"));
    await assert.rejects(hashPackage(pkgRoot), /symlink rejected/);
    await rm(join(pkgRoot, "escaped"));

    // ── patch path containment (symlink escape) ──
    const patchDir = join(patches, "good");
    assert.equal(
        await resolvePatchPath(patchDir, "patch/demo.patch"),
        join(patchDir, "patch", "demo.patch"),
    );
    await symlink(
        join(root, "outside"),
        join(patchDir, "patch", "escape.patch"),
    );
    await mkdir(join(root, "outside"), { recursive: true });
    await assert.rejects(
        resolvePatchPath(patchDir, "patch/escape.patch"),
        /escapes patch directory/,
    );
    await rm(join(patchDir, "patch", "escape.patch"));
    await assert.rejects(resolvePatchPath(patchDir, "patch/nonexistent.patch"));

    // ── status classification ──
    const demoPkg = await resolvePackage("demo", [root]);
    demoPkg.patchDir = join(patches, "good");
    // baseHash deliberately doesn't match (placeholder "a".repeat(64)), version matches →
    // same-version content difference, reverse dry-run of the fake patch fails → drifted.
    assert.equal(await getPatchStatus(manifest, demoPkg), "drifted");
    // Version mismatch is always drifted, regardless of patch state.
    const driftedManifest = { ...manifest, baseVersion: "0.9.0" };
    assert.equal(await getPatchStatus(driftedManifest, demoPkg), "drifted");
    // Missing package → missing.
    assert.equal(await getPatchStatus(manifest), "missing");
    // A real reverse-applicable patch on a matching-version package → applied.
    // Build a pristine package, compute its hash, then modify one file so the patch is "present".
    const appliedRoot = join(root, "applied-pkg");
    await mkdir(join(appliedRoot, "lib"), { recursive: true });
    await writeFile(
        join(appliedRoot, "package.json"),
        JSON.stringify({ name: "applied", version: "1.0.0" }),
    );
    await writeFile(join(appliedRoot, "lib", "a.js"), "export const a = 1;\n");
    const realHash = await hashPackage(appliedRoot);
    await writeFile(join(appliedRoot, "lib", "a.js"), "export const a = 2;\n");
    // Generate a patch that reverse-applies (patch present in working tree).
    const pristineRoot = join(root, "pristine-pkg");
    await mkdir(join(pristineRoot, "lib"), { recursive: true });
    await writeFile(
        join(pristineRoot, "package.json"),
        JSON.stringify({ name: "applied", version: "1.0.0" }),
    );
    await writeFile(join(pristineRoot, "lib", "a.js"), "export const a = 1;\n");
    const patchFile = join(patchDir, "patch", "applied.patch");
    await writeFile(patchFile, await craftDiff(pristineRoot, appliedRoot));
    const appliedManifest = {
        ...manifest,
        id: "applied",
        package: "applied",
        baseVersion: "1.0.0",
        baseHash: realHash,
        patch: "patch/applied.patch",
    };
    // git apply --directory wants the patch paths relative to the package root, without the root prefix
    const appliedPkg = {
        name: "applied",
        version: "1.0.0",
        root: appliedRoot,
        patchDir: patchDir,
    };
    const appliedStatus = await getPatchStatus(appliedManifest, appliedPkg);
    assert.equal(
        appliedStatus,
        "applied",
        `expected applied, got ${appliedStatus}`,
    );
    // After restoring the pristine file, the package is clean again.
    await writeFile(join(appliedRoot, "lib", "a.js"), "export const a = 1;\n");
    assert.equal(await getPatchStatus(appliedManifest, appliedPkg), "clean");

    // ── patch-creator helper script ──
    // Re-apply the edit so the two trees differ (the 'clean' check above reverted it).
    await writeFile(join(appliedRoot, "lib", "a.js"), "export const a = 2;\n");
    const helper = new URL(
        "./skills/patch-creator/scripts/create-patch.mjs",
        import.meta.url,
    ).pathname;
    const craftOut = join(root, "craft-out");
    const { stdout: craftJson } = await execFileAsync("node", [
        helper,
        "create",
        "craft-test",
        pristineRoot,
        appliedRoot,
        craftOut,
    ]);
    const crafted = JSON.parse(craftJson);
    assert.equal(crafted.id, "craft-test");
    assert.match(crafted.baseHash, /^sha256:[0-9a-f]{64}$/);
    assert.equal(
        crafted.baseHash,
        await hashPackage(pristineRoot),
        "helper hash must match registry algorithm",
    );
    const patchText = await readFile(crafted.patchFile, "utf8");
    assert.ok(
        !patchText.includes(root),
        "patch must not contain absolute paths",
    );
    assert.ok(
        patchText.includes("--- a/lib/a.js"),
        "must use a/ b/ prefixes for default -p1 strip",
    );
    await execFileAsync("git", [
        "apply",
        "--check",
        "--reverse",
        `--directory=${appliedRoot}`,
        crafted.patchFile,
    ]);
    await execFileAsync("git", [
        "apply",
        "--check",
        `--directory=${pristineRoot}`,
        crafted.patchFile,
    ]);
    const { stdout: hashJson } = await execFileAsync("node", [
        helper,
        "hash",
        pristineRoot,
    ]);
    assert.equal(JSON.parse(hashJson).baseHash, crafted.baseHash);

    // ── apply flow ──
    const applyRoot = join(root, "apply-pkg");
    const makeApplyPackage = async () => {
        await rm(applyRoot, { recursive: true, force: true });
        await mkdir(join(applyRoot, "lib"), { recursive: true });
        await writeFile(
            join(applyRoot, "package.json"),
            JSON.stringify({ name: "apply", version: "1.0.0" }),
        );
        await writeFile(join(applyRoot, "lib", "a.js"), "export const a = 1;\n");
    };
    await makeApplyPackage();
    const applyBaseHash = await hashPackage(applyRoot);
    const applyModified = join(root, "apply-modified");
    await mkdir(join(applyModified, "lib"), { recursive: true });
    await writeFile(
        join(applyModified, "package.json"),
        JSON.stringify({ name: "apply", version: "1.0.0" }),
    );
    await writeFile(join(applyModified, "lib", "a.js"), "export const a = 2;\n");
    const applyPatchDir = join(patches, "apply-good");
    await mkdir(join(applyPatchDir, "patch"), { recursive: true });
    await writeFile(
        join(applyPatchDir, "patch", "apply.patch"),
        await craftDiff(applyRoot, applyModified),
    );
    await writeFile(
        join(applyPatchDir, "checks.sh"),
        '#!/bin/sh\ntest "$(cat lib/a.js)" = "export const a = 2;" && echo CHECK_OK\n',
    );
    const applyManifest = {
        ...manifest,
        id: "apply-good",
        package: "apply",
        baseVersion: "1.0.0",
        baseHash: applyBaseHash,
        patch: "patch/apply.patch",
        validation: "checks.sh",
    };
    await writeFile(
        join(applyPatchDir, "manifest.json"),
        JSON.stringify(applyManifest),
    );
    const applyPkg = {
        name: "apply",
        version: "1.0.0",
        root: applyRoot,
        patchDir: applyPatchDir,
    };

    // Fresh apply: dry-run guard, real apply, reverse verify, validation run.
    const r1 = await applyPatch(applyManifest, applyPkg);
    assert.equal(r1.outcome, "applied", `expected applied, got ${r1.outcome}: ${r1.message}`);
    assert.equal(
        await readFile(join(applyRoot, "lib", "a.js"), "utf8"),
        "export const a = 2;\n",
    );
    assert.ok(r1.validation?.ok, "validation must pass");
    assert.match(r1.validation?.output ?? "", /CHECK_OK/);
    // Second apply is a no-op.
    assert.equal((await applyPatch(applyManifest, applyPkg)).outcome, "already-applied");
    // Version drift is refused.
    const r3 = await applyPatch({ ...applyManifest, baseVersion: "0.9.0" }, applyPkg);
    assert.equal(r3.outcome, "rejected");
    assert.match(r3.message, /rebase required/);
    // A patch file that exists but does not apply cleanly leaves the package untouched.
    await makeApplyPackage();
    await writeFile(join(applyPatchDir, "patch", "bad.patch"), "not a real patch");
    const r5 = await applyPatch({ ...applyManifest, patch: "patch/bad.patch" }, applyPkg);
    assert.equal(r5.outcome, "rejected", `expected rejected, got ${r5.outcome}: ${r5.message}`);
    assert.match(r5.message, /does not apply cleanly/);
    assert.equal(
        await readFile(join(applyRoot, "lib", "a.js"), "utf8"),
        "export const a = 1;\n",
        "package must be untouched when the forward check fails",
    );
    // Validation failure is reported even though the patch applied.
    await writeFile(join(applyPatchDir, "checks.sh"), "exit 1\n");
    const r4 = await applyPatch(applyManifest, applyPkg);
    assert.equal(r4.outcome, "validation-failed");
    assert.match(r4.message, /validation FAILED/);
    assert.equal(r4.validation?.ok, false);

    // Patch paths that escape the package root are refused by git itself
    // (no --unsafe-paths anywhere); a sibling file must stay untouched.
    await makeApplyPackage();
    const victimPath = join(root, "victim.txt");
    await writeFile(victimPath, "harmless\n");
    await writeFile(
        join(applyPatchDir, "patch", "escape.patch"),
        "diff --git a/../victim.txt b/../victim.txt\n--- a/../victim.txt\n+++ b/../victim.txt\n@@ -1 +1 @@\n-harmless\n+patched\n",
    );
    const r6 = await applyPatch(
        { ...applyManifest, patch: "patch/escape.patch" },
        applyPkg,
    );
    assert.equal(r6.outcome, "rejected", `expected rejected, got ${r6.outcome}: ${r6.message}`);
    assert.equal(
        await readFile(victimPath, "utf8"),
        "harmless\n",
        "file beside the package must be untouched",
    );
    await rm(victimPath);

    console.log("All integration assertions passed.");
} finally {
    await rm(root, { recursive: true, force: true });
}

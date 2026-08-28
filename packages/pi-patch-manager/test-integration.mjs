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
    discoverPatchDirs,
    getPatchStatus,
    hashPackage,
    readManifest,
    resolvePackage,
    resolvePatchPath,
} from "./index.ts";

const execFileAsync = promisify(execFile);
const root = await mkdtemp(join(tmpdir(), "pi-patch-manager-"));

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
    const diff = await execFileAsync("git", [
        "diff",
        "--no-index",
        "--binary",
        pristineRoot,
        appliedRoot,
    ]).catch((e) => e.stdout);
    await writeFile(
        patchFile,
        diff
            .replaceAll(`${pristineRoot}/`, "")
            .replaceAll(`${appliedRoot}/`, ""),
    );
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

    console.log("All integration assertions passed.");
} finally {
    await rm(root, { recursive: true, force: true });
}

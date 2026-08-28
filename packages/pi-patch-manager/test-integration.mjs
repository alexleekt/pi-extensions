import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    rm,
    stat,
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
    rebasePatch,
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
    ).then(
        (r) => r.stdout,
        (e) => e.stdout ?? "",
    );
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
        {
            ...manifest,
            rebasedFrom: {
                model: "m",
                date: "not-a-date",
                previousBase: {
                    version: "1",
                    hash: `sha256:${"a".repeat(64)}`,
                },
            },
        }, // bad date
        {
            ...manifest,
            rebasedFrom: {
                model: "m",
                date: new Date().toISOString(),
                previousBase: { version: "1", hash: "abc" },
            },
        }, // bad hash
        {
            ...manifest,
            rebasedFrom: {
                model: "m",
                date: new Date().toISOString(),
                previousBase: { version: "1" },
            },
        }, // missing previousBase.hash
        {
            ...manifest,
            rebasedFrom: {
                model: "m",
                date: new Date().toISOString(),
                previousBase: {
                    version: "1",
                    hash: `sha256:${"a".repeat(64)}`,
                },
                extra: 1,
            },
        }, // unknown field
    ];
    const rebaseableManifest = {
        ...manifest,
        rebasedFrom: {
            model: "openai-codex/gpt-5.4-mini",
            date: new Date().toISOString(),
            previousBase: {
                version: "0.9.0",
                hash: `sha256:${"c".repeat(64)}`,
            },
        },
    };
    assert.deepEqual(
        await readManifest(
            await writeFile(
                join(root, "rebased.json"),
                JSON.stringify(rebaseableManifest),
            ).then(() => join(root, "rebased.json")),
        ),
        rebaseableManifest,
    );
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
        await writeFile(
            join(applyRoot, "lib", "a.js"),
            "export const a = 1;\n",
        );
    };
    await makeApplyPackage();
    const applyBaseHash = await hashPackage(applyRoot);
    const applyModified = join(root, "apply-modified");
    await mkdir(join(applyModified, "lib"), { recursive: true });
    await writeFile(
        join(applyModified, "package.json"),
        JSON.stringify({ name: "apply", version: "1.0.0" }),
    );
    await writeFile(
        join(applyModified, "lib", "a.js"),
        "export const a = 2;\n",
    );
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
    assert.equal(
        r1.outcome,
        "applied",
        `expected applied, got ${r1.outcome}: ${r1.message}`,
    );
    assert.equal(
        await readFile(join(applyRoot, "lib", "a.js"), "utf8"),
        "export const a = 2;\n",
    );
    assert.ok(r1.validation?.ok, "validation must pass");
    assert.match(r1.validation?.output ?? "", /CHECK_OK/);
    // Second apply is a no-op.
    assert.equal(
        (await applyPatch(applyManifest, applyPkg)).outcome,
        "already-applied",
    );
    // Version drift is refused.
    const r3 = await applyPatch(
        { ...applyManifest, baseVersion: "0.9.0" },
        applyPkg,
    );
    assert.equal(r3.outcome, "rejected");
    assert.match(r3.message, /rebase required/);
    // A patch file that exists but does not apply cleanly leaves the package untouched.
    await makeApplyPackage();
    await writeFile(
        join(applyPatchDir, "patch", "bad.patch"),
        "not a real patch",
    );
    const r5 = await applyPatch(
        { ...applyManifest, patch: "patch/bad.patch" },
        applyPkg,
    );
    assert.equal(
        r5.outcome,
        "rejected",
        `expected rejected, got ${r5.outcome}: ${r5.message}`,
    );
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
    assert.equal(
        r6.outcome,
        "rejected",
        `expected rejected, got ${r6.outcome}: ${r6.message}`,
    );
    assert.equal(
        await readFile(victimPath, "utf8"),
        "harmless\n",
        "file beside the package must be untouched",
    );
    await rm(victimPath);

    // ── rebase flow ──
    // Pristine v1 package + old patch (v1 → v1-patched); the installed package has
    // drifted to v2, so the old patch neither forward- nor reverse-applies.
    const rebaseRoot = join(root, "rebase");
    const v1Root = join(rebaseRoot, "v1");
    const v1pRoot = join(rebaseRoot, "v1-patched");
    const v2Root = join(rebaseRoot, "v2");
    const v2pRoot = join(rebaseRoot, "v2-patched");
    for (const dir of [v1Root, v1pRoot, v2Root, v2pRoot]) {
        await mkdir(join(dir, "lib"), { recursive: true });
        await writeFile(
            join(dir, "package.json"),
            JSON.stringify({ name: "demo", version: "1.0.0" }),
        );
    }
    const v1 = "export const a = 1;\n";
    const v1p = "export const a = 1 patched;\n";
    const v2 = "export const a = 2;\n";
    const v2p = "export const a = 2 rebased;\n";
    await writeFile(join(v1Root, "lib", "a.js"), v1);
    await writeFile(join(v1pRoot, "lib", "a.js"), v1p);
    await writeFile(join(v2Root, "lib", "a.js"), v2);
    await writeFile(join(v2pRoot, "lib", "a.js"), v2p);
    const oldPatchText = await craftDiff(v1Root, v1pRoot);
    const candidatePatchText = await craftDiff(v2Root, v2pRoot);
    // Candidate that rebases the still-present old patch state (v1-patched) to v2-patched.
    const fromV1PatchText = await craftDiff(v1Root, v2pRoot);
    const rebaseCtx = {
        ui: { confirm: async () => approved, notify: () => {} },
    };
    const generate = async () => ({ patch: candidatePatchText });
    let approved = false;

    // Isolated rebase scenario: a fresh patch registry entry + fresh drifted package.
    const makeScenario = async (
        name,
        { liveText = v2, patchRel = "patch/demo.patch", validation } = {},
    ) => {
        const dir = join(rebaseRoot, name);
        const pkgRoot = join(rebaseRoot, `${name}-pkg`);
        await rm(dir, { recursive: true, force: true });
        await rm(pkgRoot, { recursive: true, force: true });
        await mkdir(
            join(dir, "patch", patchRel.split("/").slice(1, -1).join("/")),
            { recursive: true },
        );
        await mkdir(join(pkgRoot, "lib"), { recursive: true });
        await writeFile(
            join(pkgRoot, "package.json"),
            JSON.stringify({ name: "demo", version: "2.0.0" }),
        );
        await writeFile(join(pkgRoot, "lib", "a.js"), liveText);
        const m = {
            ...manifest,
            id: name,
            package: "demo",
            baseVersion: "1.0.0",
            baseHash: await hashPackage(v1Root),
            patch: patchRel,
            ...(validation ? { validation } : {}),
        };
        await writeFile(join(dir, "manifest.json"), JSON.stringify(m));
        await writeFile(join(dir, patchRel), oldPatchText);
        const pkg = {
            name: "demo",
            version: "2.0.0",
            root: pkgRoot,
            patchDir: dir,
        };
        const entry = { manifest: m, dir, status: "drifted", package: pkg };
        return {
            dir,
            pkgRoot,
            pkg,
            entry,
            manifest: m,
            manifestBytes: Buffer.from(JSON.stringify(m)),
            oldPatchPath: join(dir, patchRel),
        };
    };
    const readPkgSource = (pkgRoot) =>
        readFile(join(pkgRoot, "lib", "a.js"), "utf8");
    // Reference hash: pristine tree with the live identity (v2 package.json) and a given source.
    const pristineHash = async (sourceText) => {
        const ref = join(rebaseRoot, "pristine-ref");
        await rm(ref, { recursive: true, force: true });
        await mkdir(join(ref, "lib"), { recursive: true });
        await writeFile(
            join(ref, "package.json"),
            JSON.stringify({ name: "demo", version: "2.0.0" }),
        );
        await writeFile(join(ref, "lib", "a.js"), sourceText);
        return hashPackage(ref);
    };

    // Setup A: pre-approval failure paths + the success transaction.
    const setupA = await makeScenario("demo");
    const makeEntryA = (overrides = {}) => ({ ...setupA.entry, ...overrides });
    const patchBefore = await readFile(setupA.oldPatchPath);

    // A patch that is not drifted is refused without generating anything.
    const nr = await rebasePatch(
        makeEntryA({ status: "applied" }),
        setupA.pkg,
        rebaseCtx,
        { generate },
    );
    assert.equal(nr.ok, false);
    assert.match(nr.message, /not drifted/);

    // Declined approval leaves the patch file and package untouched.
    const declined = await rebasePatch(setupA.entry, setupA.pkg, rebaseCtx, {
        generate,
    });
    assert.equal(declined.ok, false);
    assert.match(declined.message, /declined/);
    assert.deepEqual(await readFile(setupA.oldPatchPath), patchBefore);
    assert.equal(await readPkgSource(setupA.pkgRoot), v2);

    // A malformed candidate is rejected without touching anything.
    const invalid = await rebasePatch(setupA.entry, setupA.pkg, rebaseCtx, {
        generate: async () => ({ patch: "not a diff" }),
    });
    assert.equal(invalid.ok, false);
    assert.match(invalid.message, /invalid patch/);
    assert.deepEqual(await readFile(setupA.oldPatchPath), patchBefore);
    assert.equal(await readPkgSource(setupA.pkgRoot), v2);

    // A candidate that fails the dry-run guard aborts; package stays drifted.
    const notApplicable = await rebasePatch(
        setupA.entry,
        setupA.pkg,
        rebaseCtx,
        {
            generate: async () => ({ patch: oldPatchText }), // v1-based patch cannot apply at v2
        },
    );
    assert.equal(notApplicable.ok, false);
    assert.match(notApplicable.message, /does not apply/);
    assert.equal(await readPkgSource(setupA.pkgRoot), v2);

    // Candidate validation failure happens before approval and mutates nothing.
    await writeFile(join(setupA.dir, "checks.sh"), "exit 1\n");
    const badValidation = await rebasePatch(
        makeEntryA({
            manifest: { ...setupA.manifest, validation: "checks.sh" },
        }),
        setupA.pkg,
        rebaseCtx,
        { generate },
    );
    assert.equal(badValidation.ok, false);
    assert.match(badValidation.message, /Candidate validation failed/);
    assert.equal(badValidation.validation?.ok, false);
    assert.deepEqual(await readFile(setupA.oldPatchPath), patchBefore);
    assert.equal(await readPkgSource(setupA.pkgRoot), v2);
    await rm(join(setupA.dir, "checks.sh"));

    // Approval now granted from here on: the remaining cases exercise the
    // post-approval transaction boundaries.
    approved = true;

    // Package mutated while the approval dialog is open: aborted before any mutation.
    const pkgChanged = await rebasePatch(setupA.entry, setupA.pkg, rebaseCtx, {
        generate: async () => {
            await writeFile(
                join(setupA.pkgRoot, "lib", "extra.js"),
                "mutated during dialog;\n",
            );
            return { patch: candidatePatchText };
        },
    });
    assert.equal(pkgChanged.ok, false);
    assert.match(pkgChanged.message, /Package changed during rebase; aborted/);
    assert.deepEqual(
        await readFile(setupA.oldPatchPath),
        patchBefore,
        "old patch bytes must be untouched",
    );
    assert.deepEqual(
        await readFile(join(setupA.dir, "manifest.json")),
        Buffer.from(JSON.stringify(setupA.manifest)),
        "manifest bytes must be untouched",
    );
    await rm(join(setupA.pkgRoot, "lib", "extra.js"));

    // Patch file edited while the approval dialog is open: aborted, nothing mutated.
    const registryChanged = await rebasePatch(
        setupA.entry,
        setupA.pkg,
        rebaseCtx,
        {
            generate: async () => {
                await writeFile(setupA.oldPatchPath, "tampered bytes");
                return { patch: candidatePatchText };
            },
        },
    );
    assert.equal(registryChanged.ok, false);
    assert.match(registryChanged.message, /registry changed during rebase/);
    assert.equal(
        await readFile(setupA.oldPatchPath, "utf8"),
        "tampered bytes",
        "rebase must not restore the tampered patch",
    );
    assert.equal(
        await readPkgSource(setupA.pkgRoot),
        v2,
        "package must be untouched",
    );
    assert.deepEqual(
        await readFile(join(setupA.dir, "manifest.json")),
        Buffer.from(JSON.stringify(setupA.manifest)),
    );
    await writeFile(setupA.oldPatchPath, oldPatchText);

    // Success: package patched, manifest records the PRISTINE new base, history written.
    const success = await rebasePatch(setupA.entry, setupA.pkg, rebaseCtx, {
        generate,
    });
    assert.equal(success.ok, true, `expected ok, got: ${success.message}`);
    assert.equal(await readPkgSource(setupA.pkgRoot), v2p);
    const updated = await readManifest(join(setupA.dir, "manifest.json"));
    assert.equal(updated.baseVersion, "2.0.0");
    // baseHash describes the PRISTINE (patch-removed) v2 tree, not the patched live tree.
    assert.equal(updated.baseHash, await pristineHash(v2));
    assert.notEqual(updated.baseHash, await hashPackage(setupA.pkgRoot));
    assert.equal(typeof updated.rebasedFrom.model, "string");
    assert.ok(updated.rebasedFrom.model.length > 0);
    assert.equal(updated.rebasedFrom.previousBase.version, "1.0.0");
    assert.equal(
        updated.rebasedFrom.previousBase.hash,
        await hashPackage(v1Root),
    );
    assert.match(updated.patch, /^patch\/demo\..+\.patch$/);
    assert.equal(
        await readFile(join(setupA.dir, updated.patch), "utf8"),
        candidatePatchText,
    );
    await assert.rejects(
        stat(join(setupA.dir, "patch", "demo.patch")),
        undefined,
        "old patch file must be removed after commit",
    );
    // The rebased entry reports "applied" on the live tree and "clean" on pristine.
    const rebasedStatus = await getPatchStatus(updated, setupA.pkg);
    assert.equal(
        rebasedStatus,
        "applied",
        `expected applied, got ${rebasedStatus}`,
    );
    await writeFile(join(setupA.pkgRoot, "lib", "a.js"), v2); // pristine reinstall
    assert.equal(await getPatchStatus(updated, setupA.pkg), "clean");
    const rebasedApply = await applyPatch(updated, setupA.pkg);
    assert.equal(
        rebasedApply.outcome,
        "applied",
        `expected applied, got ${rebasedApply.outcome}: ${rebasedApply.message}`,
    );
    assert.equal(await readPkgSource(setupA.pkgRoot), v2p);
    await writeFile(join(setupA.pkgRoot, "lib", "a.js"), v2); // leave pristine
    const historyEntries = (await readdir(join(setupA.dir, "history"))).map(
        (n) => join(setupA.dir, "history", n),
    );
    assert.equal(historyEntries.length, 1);
    const historyManifest = await readManifest(
        join(historyEntries[0], "manifest.json"),
    );
    assert.equal(historyManifest.baseVersion, "1.0.0");
    assert.equal(historyManifest.baseHash, await hashPackage(v1Root));
    assert.equal(
        await readFile(join(historyEntries[0], historyManifest.patch), "utf8"),
        oldPatchText,
    );

    // Setup B: version drifted while the old patch is still present in the tree.
    const setupB = await makeScenario("old-patch-present", { liveText: v1p });
    approved = true;
    const withOld = await rebasePatch(setupB.entry, setupB.pkg, rebaseCtx, {
        generate: async () => ({ patch: fromV1PatchText }),
    });
    assert.equal(withOld.ok, true, `expected ok, got: ${withOld.message}`);
    assert.equal(
        await readPkgSource(setupB.pkgRoot),
        v2p,
        "old patch must be removed, candidate applied",
    );
    const updatedB = await readManifest(join(setupB.dir, "manifest.json"));
    assert.equal(updatedB.baseVersion, "2.0.0");
    // Pristine base after removing the old patch is the v1 content tree.
    assert.equal(updatedB.baseHash, await pristineHash(v1));
    assert.equal(await getPatchStatus(updatedB, setupB.pkg), "applied");
    await assert.rejects(
        stat(setupB.oldPatchPath),
        undefined,
        "old patch file must be removed",
    );

    // Setup C: post-apply validation failure rolls the package back cleanly.
    const setupC = await makeScenario("rollback-clean", {
        validation: "checks.sh",
    });
    // checks.sh passes inside the staging copy (.../package) and fails on the live root.
    await writeFile(
        join(setupC.dir, "checks.sh"),
        'case "$PWD" in */package) exit 0 ;; *) exit 1 ;; esac\n',
    );
    approved = true;
    const rolledBack = await rebasePatch(setupC.entry, setupC.pkg, rebaseCtx, {
        generate,
    });
    assert.equal(rolledBack.ok, false);
    assert.match(rolledBack.message, /rolled back cleanly/);
    assert.match(rolledBack.message, /validation failed/);
    assert.equal(
        await readPkgSource(setupC.pkgRoot),
        v2,
        "candidate must be reversed",
    );
    assert.deepEqual(
        await readFile(setupC.oldPatchPath),
        Buffer.from(oldPatchText),
        "old patch restored untouched",
    );
    assert.deepEqual(
        await readFile(join(setupC.dir, "manifest.json")),
        Buffer.from(JSON.stringify(setupC.manifest)),
        "manifest untouched",
    );
    assert.equal(
        (await readdir(join(setupC.dir, "history"))).length,
        0,
        "history entry for an aborted rebase must be removed",
    );

    // Setup D: rollback failure is reported, not silently claimed.
    const setupD = await makeScenario("rollback-broken", {
        validation: "checks.sh",
    });
    await writeFile(
        join(setupD.dir, "checks.sh"),
        'case "$PWD" in */package) exit 0 ;; *) echo hacked >> lib/a.js; exit 1 ;; esac\n',
    );
    approved = true;
    const brokenRollback = await rebasePatch(
        setupD.entry,
        setupD.pkg,
        rebaseCtx,
        { generate },
    );
    assert.equal(brokenRollback.ok, false);
    assert.match(brokenRollback.message, /Rollback FAILED/);
    assert.match(brokenRollback.message, /validation failed/);
    assert.ok(
        (await readPkgSource(setupD.pkgRoot)).includes("hacked"),
        "package must honestly reflect the failed rollback",
    );

    // Setup E: nested manifest.patch paths survive history archiving.
    const setupE = await makeScenario("nested", {
        patchRel: "patch/subdir/demo.patch",
    });
    approved = true;
    const nested = await rebasePatch(setupE.entry, setupE.pkg, rebaseCtx, {
        generate,
    });
    assert.equal(nested.ok, true, `expected ok, got: ${nested.message}`);
    const nestedHistory = (await readdir(join(setupE.dir, "history"))).map(
        (n) => join(setupE.dir, "history", n),
    );
    assert.equal(nestedHistory.length, 1);
    const nestedHistoryManifest = await readManifest(
        join(nestedHistory[0], "manifest.json"),
    );
    assert.equal(nestedHistoryManifest.patch, "patch/subdir/demo.patch");
    assert.equal(
        await readFile(
            join(nestedHistory[0], nestedHistoryManifest.patch),
            "utf8",
        ),
        oldPatchText,
        "history must keep the manifest's own patch path",
    );
    const nestedUpdated = await readManifest(join(setupE.dir, "manifest.json"));
    assert.match(nestedUpdated.patch, /^patch\/subdir\/demo\..+\.patch$/);
    assert.equal(
        await readFile(join(setupE.dir, nestedUpdated.patch), "utf8"),
        candidatePatchText,
    );

    // Setup F: a history directory planted as a symlink aborts the rebase.
    const setupF = await makeScenario("history-symlink");
    await mkdir(join(root, "history-target"));
    await symlink(join(root, "history-target"), join(setupF.dir, "history"));
    approved = true;
    const symlinked = await rebasePatch(setupF.entry, setupF.pkg, rebaseCtx, {
        generate,
    });
    assert.equal(symlinked.ok, false);
    assert.match(symlinked.message, /Rebase failed/);
    assert.deepEqual(
        await readFile(setupF.oldPatchPath),
        Buffer.from(oldPatchText),
        "old patch untouched when history is unsafe",
    );
    assert.deepEqual(
        await readFile(join(setupF.dir, "manifest.json")),
        Buffer.from(JSON.stringify(setupF.manifest)),
        "manifest untouched when history is unsafe",
    );
    assert.equal(
        await readPkgSource(setupF.pkgRoot),
        v2,
        "package untouched when history is unsafe",
    );
    approved = false;

    console.log("All integration assertions passed.");
} finally {
    await rm(root, { recursive: true, force: true });
}

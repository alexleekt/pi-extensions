#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const tempRoot = mkdtempSync(join(tmpdir(), "pi-heading-pack-"));

function run(command, args, cwd) {
    const result = spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        env: { ...process.env, npm_config_update_notifier: "false" },
    });
    if (result.status !== 0) {
        const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
        throw new Error(
            `${command} ${args.join(" ")} failed\n${output.slice(-4000)}`,
        );
    }
    return result.stdout;
}

try {
    const packOutput = run(
        "npm",
        ["pack", "--json", "--pack-destination", tempRoot],
        packageRoot,
    );
    const manifest = JSON.parse(packOutput.slice(packOutput.indexOf("[")))[0];
    const packedFiles = new Set(manifest.files.map((file) => file.path));
    const requiredFiles = [
        "index.ts",
        "types.ts",
        "handlers/agent-lifecycle.ts",
        "handlers/session-lifecycle.ts",
        "handlers/turn-lifecycle.ts",
        "util/config.ts",
    ];
    const missing = requiredFiles.filter((file) => !packedFiles.has(file));
    if (missing.length > 0) {
        throw new Error(
            `Tarball is missing runtime files: ${missing.join(", ")}`,
        );
    }
    const packedTests = [...packedFiles].filter((file) =>
        file.endsWith(".test.ts"),
    );
    if (packedTests.length > 0) {
        throw new Error(
            `Tarball includes test files: ${packedTests.join(", ")}`,
        );
    }

    const installRoot = join(tempRoot, "install");
    const tarball = join(tempRoot, manifest.filename);
    run(
        "npm",
        [
            "install",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--prefix",
            installRoot,
            tarball,
        ],
        tempRoot,
    );
    writeFileSync(
        join(installRoot, "smoke.mjs"),
        [
            'import { createRequire } from "node:module";',
            'const codingAgentEntry = import.meta.resolve("@earendil-works/pi-coding-agent");',
            "const codingAgentRequire = createRequire(codingAgentEntry);",
            'const { createJiti } = codingAgentRequire("jiti");',
            "const jiti = createJiti(import.meta.url);",
            'const extension = await jiti.import("@alexleekt/pi-heading");',
            'if (typeof extension.default !== "function") {',
            '    throw new Error("Packed entrypoint has no default extension factory");',
            "}",
        ].join("\n"),
    );
    run("node", ["smoke.mjs"], installRoot);

    const installedPackage = JSON.parse(
        readFileSync(
            join(
                installRoot,
                "node_modules",
                "@alexleekt",
                "pi-heading",
                "package.json",
            ),
            "utf8",
        ),
    );
    if (installedPackage.version !== manifest.version) {
        throw new Error(
            "Installed package version does not match tarball version",
        );
    }

    console.log(
        `Packed import smoke passed (${packedFiles.size} files, ${manifest.version}).`,
    );
} finally {
    rmSync(tempRoot, { recursive: true, force: true });
}

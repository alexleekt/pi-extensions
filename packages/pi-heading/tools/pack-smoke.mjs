#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const tempRoot = mkdtempSync(join(tmpdir(), "pi-heading-pack-"));

function run(command, args, cwd) {
    const result = spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        env: {
            ...process.env,
            npm_config_update_notifier: "false",
            npm_config_allow_scripts: "",
        },
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
    const parsed = parseFirstJson(packOutput);
    // npm emits an array in some versions and a keyed object in others.
    const manifest = Array.isArray(parsed)
        ? parsed[0]
        : Object.values(parsed)[0];

    function parseFirstJson(raw) {
        const start = raw.search(/[[{]/);
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let i = start; i < raw.length; i++) {
            const ch = raw[i];
            if (inString) {
                if (escaped) escaped = false;
                else if (ch === "\\") escaped = true;
                else if (ch === '"') inString = false;
                continue;
            }
            if (ch === '"') inString = true;
            else if (ch === "[" || ch === "{") depth++;
            else if (ch === "]" || ch === "}") {
                depth--;
                if (depth === 0) return JSON.parse(raw.slice(start, i + 1));
            }
        }
        throw new Error("npm pack output contained no complete JSON value");
    }
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

    console.log(
        `Packed import smoke passed (${packedFiles.size} files, ${manifest.version}).`,
    );
} finally {
    rmSync(tempRoot, { recursive: true, force: true });
}

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "linux") process.exit(0);

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const glimpseEntry = fileURLToPath(import.meta.resolve("glimpseui"));
const glimpseRoot = join(dirname(dirname(glimpseEntry)));
const dependencyRoot = dirname(dirname(glimpseRoot));
const patchCwd = existsSync(join(dependencyRoot, "node_modules", "glimpseui"))
    ? dependencyRoot
    : packageRoot;
const patchDir = relative(patchCwd, join(packageRoot, "patches"));

const patch = spawnSync(
    "patch-package",
    ["--patch-dir", patchDir, "--error-on-fail"],
    { cwd: patchCwd, stdio: "inherit" },
);

if (patch.error || patch.status !== 0) {
    console.warn(
        "[pi-ask-user-glimpse] Could not apply the Glimpse Linux patch; continuing without the Niri window fix.",
    );
    process.exit(0);
}

const hasNativeBuildDeps =
    spawnSync(
        "pkg-config",
        ["--exists", "webkitgtk-6.0", "gtk4", "gtk4-layer-shell-0"],
        { stdio: "ignore" },
    ).status === 0 &&
    spawnSync("cargo", ["--version"], { stdio: "ignore" }).status === 0;

if (!hasNativeBuildDeps) {
    console.warn(
        "[pi-ask-user-glimpse] Glimpse patched for Niri, but Linux native build dependencies are missing; install Rust, GTK4, WebKitGTK, and gtk4-layer-shell, then rebuild Glimpse.",
    );
    process.exit(0);
}

const build = spawnSync("npm", ["run", "build:linux"], {
    cwd: glimpseRoot,
    stdio: "inherit",
});

if (build.error || build.status !== 0) {
    console.warn(
        "[pi-ask-user-glimpse] Could not rebuild the patched Glimpse Linux host; continuing with the existing host.",
    );
}

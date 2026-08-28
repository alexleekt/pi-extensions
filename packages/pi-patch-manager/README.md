# @alexleekt/pi-patch-manager

Install with `pi install npm:@alexleekt/pi-patch-manager`. The manager reads patches from `~/.pi/agent/patches/<id>/` and supports npm-style packages found under the agent, agent extensions, and current project `node_modules` roots.

Each directory contains a strict `manifest.json`. Required fields: `id`, `package`, `baseVersion`, `baseHash` (`sha256:` plus 64 lowercase hex characters), `patch` (a relative path under `patch/`), `intent`, `reason`, and `enabled`. Optional fields capture the plan's full context: `target` (`file`, `symbol`, `change` — `file` is validated as a safe relative path), `validation` (safe relative path to a checks script), `upstream` (`status` kebab-case, `url` http(s)), and `createdWith` (`provider`, `model` provenance). Unknown fields and unsafe paths are rejected.

`/patch list`, `/patch status`, and `/patch explain <id>` inspect the registry. `/patch disable <id>` atomically changes only `enabled` to false, writing through a random temp directory inside the patch directory to defeat symlink pre-planting. Apply and rebase are intentionally unavailable in v0.1 and make no changes. The `patch_status` agent tool is read-only.

Status is computed from package identity, deterministic SHA-256 hashes over a sorted file walk (symlinks rejected at every level, including the package root), and reverse `git apply --check` classification. A different package version is always drift — even if the old patch still reverse-applies. Patch files are resolved through `realpath` and must stay inside their patch directory. Git apply will eventually use `--check`, `--whitespace=error`, and argv-based subprocesses; no reject or three-way modes are used.

## Crafting patches

The package ships a `patch-creator` skill (available in pi as `/skill:patch-creator` after install). It walks through snapshotting the pristine package, editing it, generating a registry-compatible diff, and writing `manifest.json`. Its `create-patch.mjs` helper imports this package's own hash/diff logic so generated hashes always match the registry's algorithm. Crafted patches report `applied` in `/patch status` once the edit is present and identity matches. `/patch apply` and `/patch rebase` are unavailable in v0.1 — the skill documents manual editing today.
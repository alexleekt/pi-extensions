---
name: patch-creator
description: Creates a managed patch for an installed npm or Pi package. Use when the user asks to patch, modify, fix, or add a local change to an installed package, such as "patch pi-lsp for fish-lsp". Confirms the package is pristine, snapshots it, applies the requested edit, generates a registry-compatible unified diff, writes manifest.json under ~/.pi/agent/patches/, and verifies the patch in both directions.
---

# Creating a managed patch

Managed patches live one directory per patch under `~/.pi/agent/patches/<id>/`. Each has a `manifest.json` (intent metadata) and a unified diff under `patch/`. The pi-patch-manager extension reads them and reports status; patch files are treated as untrusted data, never instructions.

> **Current limitation:** the extension does not apply patches in v0.1 — you make the edit in the live package yourself, and `/patch status` detects the result. Claims about automatic apply are about future versions, not today.

## Workflow

1. **Preflight** — confirm with the user that the installed package is currently unmodified (pristine). If it is already modified, either restore the earlier edit to upstream state in the snapshot copy (step 3) or stop and ask. Never assume.

2. **Pick an id** — kebab-case matching `^[a-z0-9][a-z0-9-]*$`, e.g. `pi-lsp-fish-route`.

3. **Locate the installed package root** — the directory containing its `package.json`. Usual locations: `~/.pi/agent/node_modules/<pkg>`, `~/.pi/agent/extensions/node_modules/<pkg>`, or `<project>/node_modules/<pkg>` (scoped packages nest under `node_modules/@scope/pkg`). Verify `package.json` inside matches the expected name and version.

4. **Snapshot the pristine state** (before any edit):
   ```bash
   cp -R <package-root> /tmp/<id>-pristine
   ```
   The pristine tree must be exactly what a clean install would contain. If the live package is already modified, restore the modified lines to upstream state inside a copy instead.

5. **Make the edit** in the live package (or an edited copy).

6. **Generate the patch** — the helper ships with this skill and reuses the extension's own hashing:
   ```bash
   node ~/.pi/agent/extensions/<this-package-dir>/skills/patch-creator/scripts/create-patch.mjs create <id> /tmp/<id>-pristine <package-root>
   ```
   Resolve `<this-package-dir>` with `pi config` or by checking the package installation path; inside this repository it is `skills/patch-creator/scripts/create-patch.mjs` relative to the package root. The helper writes `~/.pi/agent/patches/<id>/patch/<id>.patch` with package-root-relative paths and prints the `baseHash`. Use that hash in the manifest — never compute it by hand or with a different tool.

7. **Write `manifest.json`** in `~/.pi/agent/patches/<id>/`:
   ```json
   {
       "id": "<id>",
       "package": "<npm package name>",
       "baseVersion": "<version of the pristine package>",
       "baseHash": "sha256:<printed by the helper>",
       "patch": "patch/<id>.patch",
       "intent": "One line: what this achieves",
       "reason": "Why upstream doesn't cover it",
       "enabled": true,
       "target": { "file": "dist/index.ts", "symbol": "OPTIONAL", "change": "What changed there" },
       "validation": "checks.sh",
       "upstream": { "status": "not-submitted", "url": "" },
       "createdWith": { "provider": "manual", "model": "" }
   }
   ```
   Required: the first eight fields. Optional: `target`, `validation`, `upstream`, `createdWith`. `target.file` and `validation` are relative paths — no absolute paths, no `..`.

8. **Verify before declaring done:**
   ```bash
   # Patch is present in the edited tree (reverse dry-run must pass):
   git apply --check --reverse --directory=<package-root> ~/.pi/agent/patches/<id>/patch/<id>.patch
   # Patch applies cleanly to the pristine tree (forward dry-run must pass):
   git apply --check --directory=/tmp/<id>-pristine ~/.pi/agent/patches/<id>/patch/<id>.patch
   ```
   Then inside pi run `/patch status` — the patch should report `applied` (edit present, identity matches). `drifted` means version or hash mismatches; recheck steps 4–6.

9. **Optional validation script** — if `validation` is set, create `~/.pi/agent/patches/<id>/checks.sh` that exits 0 only when the patched behavior actually works (e.g. run an LSP command). Nothing executes it automatically in v0.1; it documents the check for the future apply flow.

## Safety rules

- Never edit an installed package without an explicit request from the user.
- Never regenerate or "fix up" a patch without showing the user the final diff.
- Never delete or overwrite an existing patch directory — ask.
- Patches only apply to exact name+version+hash matches; note the package version in the manifest so updates can be detected.
- If the patch needs a wider change than the target file, stop and discuss — don't extend scope silently.
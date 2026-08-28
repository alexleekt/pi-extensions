# pi-patch-manager plan

Status as of v0.2.0: Phases 1 and 2 are implemented and tested. `/patch rebase` is an explicit stub; the deferred phases below are the remaining roadmap. See `README.md` for the shipped feature set, `AGENT.md` for invariants, and `docs/session/2026-08-27-design-synthesis.md` for the v0.1 scope decisions recorded during design.

## Goal

A Pi extension that manages persistent local patches to installed Pi/npm packages. It should preserve why a patch exists, what it changes, and how it was produced, so package updates become a guided rebase instead of a broken or forgotten local edit.

## Example use case: Fish shell LSP

This is an illustrative example, not a shipped feature. A machine has `fish-lsp` installed, but `@narumitw/pi-lsp` has no built-in `.fish` route. The managed patch adds the route to the package's runtime catalog:

```ts
{
  name: "fish-lsp",
  command: ["fish-lsp", "start"],
  extensions: [".fish"]
}
```

The patch metadata records the intent (local compatibility route), the installed `fish-lsp` version, and upstream status. When `pi-lsp` updates and the patch no longer applies, the rebase flow (Phases 2–3) should use that intent to decide whether the route belongs in the new catalog, generate a reviewable candidate, run the patch's validation check, and require approval before replacing it.

A fish-route patch was created manually with the `patch-creator` skill during development; it is not shipped with the package.

## Problem

`patch-package` can store and reapply diffs, but it does not capture intent. When a package changes, a failed patch only says that line context no longer matches. The original design goal, relevant source, validation, and model context are lost.

## Design

One directory per managed patch under `~/.pi/agent/patches/`:

```text
~/.pi/agent/patches/
└── <patch-id>/
    ├── manifest.json
    ├── patch/
    │   └── <package>.patch
    └── checks.sh          # optional, documented validation
```

The shipped manifest schema is specified in `README.md` and enforced by `index.ts`. Compared to the original draft, the fields were renamed: `packageVersion` → `baseVersion`, `packageHash` → `baseHash` (`sha256:` plus 64 hex characters). Optional fields capture target (`file`/`symbol`/`change`), `validation`, `upstream`, and `createdWith` provenance. Unknown fields and unsafe paths are rejected.

## Commands

```text
/patch list                 List managed patches and status
/patch status               Detect package drift and patch failures
/patch explain <id>         Show intent, rationale, model, and upstream status
/patch apply [id]           Apply one or all patches          (stub in v0.1)
/patch rebase <id>          Prepare an updated patch after drift (stub in v0.1)
/patch disable <id>         Disable a patch without deleting it
```

The read-only `patch_status` agent tool exists today. When apply/rebase land, the tool gains rebase-request capability, and applying an LLM-generated replacement must require explicit user approval.

## Drift detection (implemented)

1. Discover managed patch directories.
2. Resolve each target package and record its installed version/hash.
3. Classify via reverse `git apply --check`:
   - package hash matches and patch is present → `clean`;
   - patch present and package version unchanged → `applied`;
   - version mismatch is always `drifted`, even if the old patch still reverse-applies;
   - unresolvable errors → `failed`.

## Drift rebase workflow (deferred, Phases 2–3)

1. On drift, collect old/new package version and hash, the original patch, intent and rationale, target symbols and source anchors, old and new relevant source, and the validation command.
2. Ask the model for a candidate replacement patch.
3. Show the candidate diff and validation result.
4. Apply only after approval.
5. Update the manifest with the new package identity and rebase model metadata.
6. Keep the previous patch/context in a history directory or git history.

## Safety rules

- Never silently accept an LLM-generated rebase.
- Never overwrite a package when patch application fails.
- Verify package name, version, and installed path before editing.
- Store hashes so a same-version package replacement is detected.
- Run the patch's validation command before marking it healthy. (Implemented for apply in v0.2: `checks.sh` runs after application and its result is reported.)
- Treat patch files and package source as code, not trusted instructions.
- Disable a patch when its intent no longer matches the new package behavior.
- Report when a patched extension is already loaded and requires `/reload` or a Pi restart. (Deferred to Phase 4.)

## Patch engine decision

The plan originally specified `patch-package`. The shipped engine is system `git apply` invoked with argv-based subprocesses (`--check`, `--unsafe-paths`, `--directory`, `--whitespace=error`; never `--reject` or `--3way`). Rationale: patch-package is semi-maintained (last meaningful tag 2023, large dependency tree); git apply is already present, and the diff format is compatible. The extension has zero runtime dependencies, and AGENT.md requires asking before adding any.

## Integration with Pi package updates (Phase 4, deferred)

- Reusable patch application module (the `gitDryRun` helper in `index.ts` is the groundwork).
- Session-start drift notification.
- A documented shell/post-update hook for applying patches after `pi update --extensions`.
- A restart/reload notice when a loaded package was modified.

If Pi later exposes a stable package-update lifecycle event, use it to trigger the same application module.

## Implementation phases

### Phase 1: registry and status — DONE (v0.1)

- Manifest schema and strict validation, including symlink rejection at every level, path containment, atomic `disable` writes.
- Patch directory discovery, package resolution across agent/extensions/project roots.
- `/patch list`, `/patch status`, `/patch explain`, `/patch disable`; `apply`/`rebase` as explicit stubs.
- `test-integration.mjs` covers malformed manifests, missing packages, version drift, hash drift, symlink escapes.

### Phase 2: apply flow — DONE (v0.2)

- `/patch apply [id]` with dry-run guard (`git apply --check`), all-or-nothing apply, and safe failure reporting.
- Git subprocesses run from a repository-neutral cwd with `GIT_DIR`/`GIT_WORK_TREE` stripped.
- The patch's validation command (`checks.sh`) executes after application (bash, argv-only, 60s timeout); pass/fail is reported.
- Reverse verification after apply; `already-applied` and drift cases refuse to mutate.

### Phase 3: guided rebases — deferred

- Capture relevant source around patch targets.
- Structured rebase prompt from manifest metadata; candidate diff generation without automatic writes.
- Approval, validation, and manifest update flow; rebase history.

### Phase 4: package-update integration — deferred

- Session-start drift notices; documented post-update hook.
- Detect whether the affected Pi extension is loaded; offer `/reload` when safe, otherwise require restart.

### Phase 5: quality-of-life — deferred

- Patch grouping.
- Upstream issue/PR tracking beyond the manifest field.
- Patch health summary in the Pi footer or status output.
- Export/import of the patch registry.
- Optional repository-backed patch storage (the `create-patch.mjs` patches-root override is the seed).

## Non-goals

- Writing a custom diff engine; the engine is system `git apply`.
- Automatically rewriting patches without review.
- Managing arbitrary system packages outside the configured Pi/npm package roots.
- Providing a general package manager; existing Pi package managers already cover installation and updates.

## Acceptance criteria

- Multiple independent patches coexist without sharing state. ✔
- Each patch explains its intent, rationale, target, validation, upstream status, and model provenance. ✔ (schema; upstream tracking workflow still open)
- Package drift is detected before a stale patch is trusted. ✔
- A patch reapply is automatic only when it applies cleanly. ✔ (in v0.2 terms: `apply` refuses to mutate unless the dry-run passes; there is still no automatic re-apply on update)
- Drift produces a reviewable candidate patch, not a silent mutation. — pending Phase 3
- A failed patch leaves the installed package untouched and gives an actionable report. ✔ (vacuously in v0.1: nothing writes)
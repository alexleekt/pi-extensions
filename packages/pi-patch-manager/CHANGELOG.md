# Changelog

All notable changes to this project are documented here.

## [0.2.0] - 2026-08-28

- Implemented `/patch apply [id]` (Phase 2): applies one or all enabled patches through a dry-run guard (`git apply --check`), an all-or-nothing apply (never `--reject`/`--3way`), and reverse verification. Patch bytes are snapshotted to a private temp file so dry-run, apply, and verification inspect identical bytes.
- Git subprocesses run at the package root with `--no-index` and all inherited `GIT_*` environment stripped; `--unsafe-paths` was removed entirely — patches targeting paths outside the package root are refused by git.
- Drifted packages are refused with a rebase hint; already-applied and disabled patches are reported, not re-applied.
- `manifest.validation` scripts now execute after application (bash, argv-only, 60s timeout with SIGKILL) and their pass/fail output is reported; a failed validation yields the distinct `validation-failed` outcome.
- Git subprocess path resolution no longer depends on the cwd being inside or outside a git repository.
- `create-patch.mjs` self-verifies the generated patch (forward against pristine, reverse against edited) before reporting success.
- Engines raised to Node >=23.6.0 (type-stripping is required to run the shipped helper and tests).
- Rebase remains an explicit stub.

## [0.1.0] - 2026-08-28

- Scaffold read-only patch registry inspection and safe disable support.
- Added manifest validation, npm-style resolution, and deterministic hashing.
- Added Git dry-run helper for the future apply implementation.
- Added the `patch-creator` skill (shipped via `pi.skills`) with a `create-patch.mjs` helper that reuses the extension's hash logic to generate registry-compatible patches.
- Hardened validation: `reason` required, optional `target`/`validation`/`upstream`/`createdWith` fields with strict type guards and path-safety checks.
- Drift detection: a changed package version is always reported as `drifted`, even when the old patch still reverse-applies.
- Patch files resolved via `realpath` and contained within their patch directory; symlink escapes rejected.
- `hashPackage` realpaths its input root; `patch disable` writes through a random temp directory (no predictable temp paths).
- Switched to TypeBox schema for the `patch_status` tool registration.
- Package resolution covers the agent npm directory in both slash commands and the `patch_status` tool.
- Git dry-run passes `--unsafe-paths` so patch classification matches the future apply flow.
- Phase 1 of the roadmap (registry and status) is complete; `PLAN.md` tracks the remaining phases and supersedes the original root-level plan document.
# Changelog

All notable changes to this project are documented here.

## [Unreleased]

- Rebase transactions made crash-safe and roll-back-safe: `baseHash` now always describes the pristine (patch-removed) package — a successful rebase previously recorded the patched live-tree hash as the base and then mis-reported status; it now hashes the staging copy after removing the old patch and before applying the candidate, and reports `applied` on the live tree / `clean` on a pristine reinstall.
- Every post-approval failure (including registry-commit and manifest-rename failures) routes through a tracked rollback that restores the old patch, verifies the restored tree against the recorded pre-rebase hash, and reports primary and rollback errors together when restoration fails.
- Registry consistency (manifest bytes, patch bytes, resolved patch path) is now checked immediately after approval and before history or package mutation, in addition to the post-apply second guard.
- The rebase commit writes the candidate to a new immutable contained patch path and atomically renames only the manifest as the commit point; a crash no longer leaves a new manifest referencing old patch bytes. History archives preserve nested manifest `patch` paths.
- Untrusted rebase input is size-capped: oversized original patches are rejected before reading, manifest/context fields and each source excerpt are bounded, and the total model prompt must fit a byte budget before the LLM call.
- Rebase context now includes bounded source excerpts from the newly installed package around each hunk (diff preimage/postimage kept separate).
- Declared the `@earendil-works/pi-ai` peer dependency (used by the `/patch rebase` model flow; previously resolved only via hoisting).

## [0.3.0] - 2026-08-28

- Implemented `/patch rebase <id>` (Phase 3): drift context collection (old/new versions and hashes, patch targets, intent, validation), LLM candidate generation via `completeSimple` with the first available model, and manifest support for `rebasedFrom` provenance (`model`, `date`, `previousBase`).
- Candidates are validated before approval: JSON shape, size caps, safe-path checks on every diff target, dry-run forward apply plus reverse verification in a private temp copy, and `checks.sh` there.
- An explicit `ui.confirm` approval gates all mutations; the package hash and identity are re-verified at apply time.
- Previous patch and manifest are archived under `history/` (symlink-checked, contained within the patch directory, mode 0600).
- Post-apply validation, package identity, and patch-registry consistency checks roll the candidate back best-effort on failure instead of keeping a broken state.
- LLM call is injectable for tests (`RebaseOptions.generate`); integration tests cover refusal, decline, invalid candidate, dry-run failure, validation failure, and the success path with manifest and history assertions.

## [0.2.0] - 2026-08-28

- Implemented `/patch apply [id]` (Phase 2): applies one or all enabled patches through a dry-run guard (`git apply --check`), an all-or-nothing apply (never `--reject`/`--3way`), and reverse verification. Patch bytes are snapshotted to a private temp file so dry-run, apply, and verification inspect identical bytes.
- Git subprocesses run at the package root with `--no-index` and all inherited `GIT_*` environment stripped; `--unsafe-paths` was removed entirely — patches targeting paths outside the package root are refused by git.
- Drifted packages are refused with a rebase hint; already-applied and disabled patches are reported, not re-applied.
- `manifest.validation` scripts now execute after application (bash, argv-only, 60s timeout with SIGKILL) and their pass/fail output is reported; a failed validation yields the distinct `validation-failed` outcome.
- Git subprocess path resolution no longer depends on the cwd being inside or outside a git repository.
- `create-patch.mjs` self-verifies the generated patch (forward against pristine, reverse against edited) before reporting success.
- Engines raised to Node >=23.6.0 (type-stripping is required to run the shipped helper and tests).
- Rebase was an explicit stub (implemented in 0.3.0).

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
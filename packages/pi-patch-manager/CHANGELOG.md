# Changelog

All notable changes to this project are documented here.

## [0.1.0] - Unreleased

- Scaffold read-only patch registry inspection and safe disable support.
- Added manifest validation, npm-style resolution, and deterministic hashing.
- Added Git dry-run helper for the future apply implementation.
- Added the `patch-creator` skill (shipped via `pi.skills`) with a `create-patch.mjs` helper that reuses the extension's hash logic to generate registry-compatible patches.
- Hardened validation: `reason` required, optional `target`/`validation`/`upstream`/`createdWith` fields with strict type guards and path-safety checks.
- Drift detection: a changed package version is always reported as `drifted`, even when the old patch still reverse-applies.
- Patch files resolved via `realpath` and contained within their patch directory; symlink escapes rejected.
- `hashPackage` realpaths its input root; `patch disable` writes through a random temp directory (no predictable temp paths).
- Switched to TypeBox schema for the `patch_status` tool registration.
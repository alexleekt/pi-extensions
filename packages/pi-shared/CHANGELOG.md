# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2026-05-27

### Changed

- Standardize package descriptions, keywords, and README format across all packages
- Refactor AGENT.md files per my-agent-rules

## [0.1.2] - 2026-05-20

### Fixed

- Reconstructed corrupted `prompt-eval.ts` (91KB malformed regex from jj-to-git migration). Restored `pastTense()`, `noTrailingPeriod()`, `alignsWithExpected()`, and `optimizeSuite()` functions from usage patterns.

## [0.1.1] - 2026-05-20

### Added

- `prompt-eval.ts` — generalized prompt evaluation framework with `runSuite`, `generateReport`, `scorers`, and `optimizeSuite`.
- `session.ts` — shared session utilities.
- `types/pi.d.ts` — shared Pi extension types.

## [0.1.0] - 2026-05-14

### Added

- Initial release: shared types and utilities for Pi extensions.

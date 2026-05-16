# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.12.0] - 2026-05-09

### Added

- **Menu Loop Helper**: `runMenuLoop()` abstraction eliminates duplication between main and nested menus
- **Gist Submenu**: `executeGistConfig()` consolidates all Gist operations into a single "Gist..." entry
- **Orphaned Package Cleanup**: `cleanupOrphanedPackages()` removes packages from settings that are neither installed locally nor available on npm; parallelized with 5-concurrency batching
- **NPM Existence Cache**: `packageExistsOnNpm()` with 24h TTL cache for registry lookups; safe fallback on network errors
- **Package Cleanup Tests**: `test/package-cleanup.test.ts` with 6 test scenarios

### Changed

- **Menu Strings Simplified**:
  - Main menu: 6 items → 5 items (removed Help; still accessible via `/package-guard help` subcommand)
  - Config submenu: 7 items → max 3 items (Gist options collapsed into "Gist..." submenu)
  - "Auto-sync" terminology eliminated everywhere; replaced with "backup on/off"
  - Scan label: "🔧 Fix N unregistered packages" → "🔧 Register N"
  - Backup label: "Save backup to file + Gist" → "Backup"
  - Config label: "Configuration settings" → "Config"
  - Gist labels shortened: "Create new Gist" → "Create Gist", "Connect existing Gist" → "Connect Gist", etc.
- **Widget Format**: Compact single-line status: `📦 12 │ 🔧 2 │ 💾 local │ ☁️ abc123 ⏳on`
- **Startup Status**: `3 packages to register. Run /package-guard`

### Fixed

- Widget now clears consistently on all exit paths (Escape key and Exit selection)
- `gistEnabled` state resets correctly when clearing Gist connection via empty input
- Config widget shows consistent "☁️ not configured" / "⏸️ off" when no Gist is set

### Documentation

- Updated all menu references across 12 documentation files
- Translation template updated with simplified labels

## [0.11.0] - 2026-05-05

### Added

- **Keyword-Based Detection**: Detect pi extensions without conventional naming:
  - `PI_KEYWORDS` exported constant: `["pi-coding-agent", "pi-extension", "pi-package"]`
  - `hasPiExtensionKeyword()` reads package.json and checks for pi keywords
  - `getKeywordOnlyPackages()` auto-discovers packages via npm list + keyword scan
  - Enhanced `isGlobalPiInstall()` with `knownKeywordPackages` parameter
  - Settings persistence for discovered keyword-only packages
  - Comprehensive test coverage (new `test/keyword-detection.test.ts`)
  - Scoped `-pi` suffix detection tests added to `npm-guard.test.ts` and `regex.test.ts`

This enables detection of packages like `@touchskyer/memex` and `context-mode`
that are pi extensions but don't use `pi-*` or `*-pi` naming conventions.

## [0.10.0] - 2026-04-24

### Added

- **Schema Validation**: Strict validation with migration path for legacy backups:
  - New backups include `$schema` field with versioned URL
  - `validatePackageSnapshot()` for comprehensive backup validation
  - `isLegacyBackup()` to detect pre-schema backups
  - `migrateLegacyBackup()` to upgrade legacy backups with user consent
  - Migration UI prompts during restore workflow
  - 52 new tests covering validation and migration scenarios
- **JSON Schema**: `schema/package-snapshot.json` for external validation

### Changed

- **Backup Format**: Simplified schema with `$schema` field for future-proofing:
  - Removed `registeredPackages` and `unregisteredPackages` (derived fields)
  - Only `npmPackages` array is stored (canonical source of truth)
  - Registration state computed at restore time from current pi settings
- **Restore Workflow**: Enhanced to detect and migrate legacy backups
- **i18n**: Added `restore.all_installed` key for simplified schema restore flow

## [0.9.0] - 2026-04-23

### Changed

- **Naming**: Renamed core types for semantic clarity:
  - `PackageDiff` → `PackageStatus` (with `@deprecated` alias for backward compatibility)
  - `GuardConfig` → `ExtensionSettings` (with `@deprecated` alias)
  - `BackupData` → `PackageSnapshot` (with `@deprecated` alias)
  - `syncOrphanedPackages()` → `registerPackages()`
  - `analyzePackages()` → `checkRegistrationStatus()`
  - `orphaned` → `unregistered` throughout codebase and documentation
- **Documentation**: Complete reorganization:
  - Split monolithic docs into 5 epics with user stories and acceptance criteria
  - Created `user-guides/` for task-oriented documentation
  - Created `reference/` for technical lookup
  - Created `development/` for contributor documentation
  - Added architecture decisions document (naming RFC)
  - Cleaned up archive/ to retain only essential historical docs

### Added

- **Test coverage**: 104 new tests across 5 suites:
  - `session-start.test.ts` - Startup detection and package analysis
  - `npm-guard.test.ts` - NPM install interception patterns
  - `restore-workflow.test.ts` - Selective restore operations
  - `gist-operations.test.ts` - Gist create/delete/sync
  - `menu-navigation.test.ts` - Menu UI navigation and help display
- **Documentation**: 32 new documentation files with traceability mapping

### Fixed

- **Test coverage**: Addressed all 5 documented coverage gaps from traceability matrix
- **Documentation**: i18n key migration guide added to contributing docs

## [0.8.2] - 2026-04-23

### Fixed

- **i18n**: Handle empty string in select expressions correctly
- **i18n**: Process nested interpolations in select expressions properly
- **Security**: `isValidGistId()` now requires minimum 32-character hex strings to prevent empty string bypass
- **Security**: `isValidBackupPath()` now uses `resolve()` instead of `join()` for proper path traversal prevention
- **Validation**: Added `isBackupData()` type guard for comprehensive backup data validation
- **Performance**: Added 5-second TTL cache to `getNpmGlobalPackages()` to prevent UI blocking during menu loops
- **Code quality**: Improved `syncOrphanedPackages()` with Set-based normalization to prevent duplicate formats
- **Cleanup**: Replaced single-file temp cleanup with isolated `mkdtempSync()` directories for atomic cleanup
- **DX**: Added `process.env.DEBUG` conditional logging for npm operation failures

### Added

- **API**: Exported `isBackupData` type guard in public API (`extensions/api.ts`)

## [0.8.1] - 2026-04-22

### Fixed

- **i18n**: Correct ICU MessageFormat nested brace parsing bug where plural expressions showed literal text like "other {packages}}" instead of proper plural forms
- **Performance**: O(n²) → O(n) using sticky regex instead of string slicing in `formatMessage()`
- **Code quality**: Deduplicated `parsePluralOptions`/`parseSelectOptions` into shared `parseIcuOptions` implementation

## [0.7.0] - 2026-04-19

### Fixed

- **i18n**: Removed 3 unused translation keys (`backup.gist_failed`, `config.path_default`, `config.gist_not_configured`) that were defined but never used
- **Testing**: Fixed i18n key validation regex to correctly parse translation keys and avoid false positives from string content

## [0.7.0] - 2026-04-19

### Added

- **Security validation**: `isValidGistId()` and `isValidBackupPath()` functions for preventing command injection and path traversal attacks
- **Pattern exports**: `NPM_GLOBAL_PATTERN`, `PI_PACKAGE_PATTERN`, and `isGlobalPiInstall()` exported for testing
- **Testing API**: Documented all exported test functions in CONTRIBUTING.md
- **Security documentation**: Added "Security Features" section to USAGE.md

### Changed

- **Lean test suite**: Refactored from 390 to 179 tests with equivalent coverage
- **i18n key**: Added `restore.invalid_path` translation key for security validation

### Fixed

- **Documentation**: Corrected test count references (100 → 179) across AGENTS.md, CONTRIBUTING.md, CHANGELOG.md
- **Documentation**: Updated AGENTS.md last updated date and test file organization
- **Documentation**: Added i18n technical details to CONTRIBUTING.md
- **Linting**: Fixed template literal issue in `isValidBackupPath()`
- **CHANGELOG**: Added missing version compare links for [0.5.0] and [0.6.0]

## [0.6.0] - 2026-04-19

### Added

- **Documentation i18n**: Restructured docs into `docs/en-US/` with full localization support
- **Runtime i18n**: Complete ICU MessageFormat implementation for all UI strings
- **Type-safe translations**: 74 translation keys with full TypeScript autocomplete
- **Locale detection**: Auto-detects locale from `~/.pi/agent/settings.json`
- **Translation tests**: 154 tests validating all translation keys are valid and used
- **Contributing guide**: New translation contribution workflow in `docs/en-US/CONTRIBUTING.md`
- **Zero dependencies**: Custom ~2KB i18n engine, no external libraries needed

## [0.5.0] - 2026-04-18

### Added

- **Dev Mode Helpers**: Add `just dev-mode`, `just user-mode`, and `just dev-status` commands for easier local development workflow
- Self-exclusion test coverage for `pi-pkg-guard` package detection

### Fixed

- Prevent `pi-pkg-guard` from detecting itself as an orphaned package when running in dev mode via symlink

## [0.4.9] - 2026-04-18

### Fixed

- Fix GitHub token permissions for release creation (needs `contents: write`)

## [0.4.8] - 2026-04-18

### Fixed

- **MAJOR**: Use Node.js 24 instead of 22 for built-in npm 11+ Trusted Publishing support
- Simplified workflow following npm official documentation
- Remove --provenance flag (automatic with OIDC)
- Remove workarounds for broken npm toolcache

## [0.4.7] - 2026-04-18

### Fixed

- Fixed shellcheck quoting warnings in CI workflow

## [0.4.6] - 2026-04-18

### Fixed

- Install npm directly from registry tarball instead of Corepack or self-upgrade
- Fixes broken npm toolcache in Node.js 22.22.2 GitHub Actions runners

## [0.4.5] - 2026-04-18

### Fixed

- Use Corepack to enable npm instead of broken `npm install -g npm@latest`
- Workaround for Node.js 22.22.2 toolcache issue with missing `promise-retry` module

## [0.4.4] - 2026-04-18

### Fixed

- Upgrade npm to latest version in CI for Trusted Publishing compatibility
- Fixes misleading 404 error from npm <10 with OIDC trusted publishing

## [0.4.3] - 2026-04-18

### Fixed

- Fixed npm authentication for Trusted Publishing by removing NODE_AUTH_TOKEN override
- Let actions/setup-node handle OIDC token exchange automatically

## [0.4.2] - 2026-04-18

### Fixed

- Fixed npm Trusted Publishing workflow configuration
- Added debugging and auth clearing steps for OIDC token exchange

## [0.4.1] - 2026-04-18

### Fixed

- Fixed import statement ordering to satisfy Biome `check` command in CI
- Corrected `node:child_process` and `node:fs` imports to be alphabetically sorted

## [0.4.0] - 2026-04-17

### Fixed

- Removed duplicate `check` job in CI workflow that was causing redundant runs

### Changed

- Upgraded GitHub Actions to Node.js 22 for native TypeScript test support
- Updated actions to `actions/checkout@v6` and `actions/setup-node@v6`
- Added actionlint and git hooks for pre-commit validation
- Improved CI test glob patterns for cross-platform compatibility

## [0.3.0] - 2026-04-16

### Added

- **Automated CI/CD**: GitHub Actions workflows for testing and publishing
- **Trusted Publishing**: OIDC-based npm authentication (no long-lived tokens needed)
- **Auto-release**: Pushing a git tag automatically creates GitHub Release and publishes to npm
- **Provenance**: Packages now publish with attestation linking to GitHub source

### Changed

- Simplified release process: `just release` now auto-detects version from package.json
- Updated documentation with Trusted Publishing setup instructions

## [0.2.0] - 2026-04-15

### Added

- **Enhanced package detection**: Added support for `*-pi` suffix packages (e.g., `lsp-pi`)
- **Keyword validation**: Packages are now validated via `package.json` keywords (`pi-coding-agent`, `pi-extension`, `pi-package`) to filter out non-pi packages
- Improved scoped package detection for packages ending with `-pi`

### Fixed

- Removed duplicate `pi-extension` from `PI_KEYWORDS` constant
- Updated README documentation to reflect new detection patterns

## [0.1.1] - 2026-04-12

### Fixed

- Improved type guard validation with better indentation
- Fixed repository name references

## [0.1.0] - 2026-04-11

### Added

- Initial release of pi-pkg-guard extension
- **Startup Check**: Detect orphaned packages on pi startup (debounced to once/hour)
- **Sync Command**: `/pi-pkg-guard` - Auto-register orphaned packages in settings.json
- **npm Guard**: Warns when bash tool runs `npm install -g pi-*` commands
- Support for both `pi-foo` and `npm:pi-foo` package name formats
- Exclusion of core package `@earendil-works/pi-coding-agent` from orphaned detection
- Comprehensive test suite with 179 test cases covering type guards, package analysis, regex patterns, gist utilities, and i18n validation
- Type-safe TypeScript implementation with proper interfaces and type guards

### Technical Details

- Uses Pi Extension API (`ExtensionAPI`) for seamless integration
- Namespaced status key: `ext:pi-pkg-guard:v1`
- Silent failure mode for non-critical operations (never blocks pi)
- 1-hour debounce on startup checks to avoid excessive npm list calls

[Unreleased]: https://github.com/earendil-works/pi-mono/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/earendil-works/pi-mono/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/earendil-works/pi-mono/compare/v0.4.9...v0.5.0
[0.4.9]: https://github.com/earendil-works/pi-mono/compare/v0.4.8...v0.4.9
[0.4.8]: https://github.com/earendil-works/pi-mono/compare/v0.4.7...v0.4.8
[0.4.7]: https://github.com/earendil-works/pi-mono/compare/v0.4.6...v0.4.7
[0.4.6]: https://github.com/earendil-works/pi-mono/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/earendil-works/pi-mono/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/earendil-works/pi-mono/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/earendil-works/pi-mono/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/earendil-works/pi-mono/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/earendil-works/pi-mono/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/earendil-works/pi-mono/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/earendil-works/pi-mono/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/earendil-works/pi-mono/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/earendil-works/pi-mono/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/earendil-works/pi-mono/releases/tag/v0.1.0

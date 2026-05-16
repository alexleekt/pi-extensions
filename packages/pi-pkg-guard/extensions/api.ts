/**
 * Public API for pi-pkg-guard
 *
 * Clean, organized exports for developers using this extension programmatically.
 * All internal implementation details (command handlers, UI logic) are excluded.
 *
 * @example
 * ```typescript
 * import {
 *   isPiSettings,
 *   isPackageSnapshot,
 *   extractGistId,
 *   checkRegistrationStatus,
 *   registerPackages,
 * } from "pi-pkg-guard/extensions/api.js";
 *
 * // Validate settings
 * const settings = { packages: ["pi-foo"] };
 * if (isPiSettings(settings)) {
 *   console.log("Valid settings");
 * }
 *
 * // Validate backup data
 * const backup = {
 *   $schema: "https://raw.githubusercontent.com/earendil-works/pi-mono/v0.9.0/packages/pi-pkg-guard/schema/package-snapshot.json",
 *   timestamp: "2026-04-23T10:30:00Z",
 *   npmPackages: ["pi-foo"]
 * };
 * if (isPackageSnapshot(backup)) {
 *   console.log("Valid backup structure");
 * }
 *
 * // Analyze packages
 * const status = checkRegistrationStatus();
 * if (status.hasUnregistered) {
 *   console.log(`Found ${status.unregistered.length} unregistered packages`);
 *   registerPackages(status);
 * }
 * ```
 */

// Type Guards - Runtime validation
export {
	isPackageSnapshot,
	isBashToolInput,
	isExtensionSettings,
	isPiSettings,
} from "./index.js";

// Validation utilities
export {
	extractGistId,
	isValidGistId,
	isValidBackupPath,
} from "./index.js";

// Package utilities
export {
	normalizePackageName,
	hasPiExtensionKeyword,
} from "./index.js";

// Package analysis
export {
	getNpmGlobalPackages,
	readPiSettings,
	checkRegistrationStatus,
	registerPackages,
} from "./index.js";

// Gist operations
export {
	isGhInstalled,
	syncGistBackup,
	createGist,
	deleteGist,
	getGistContent,
} from "./index.js";

// Types
export type {
	PackageStatus,
	PiSettings,
	ExtensionSettings,
	PackageSnapshot,
	// Legacy type aliases for backward compatibility
	PackageDiff,
	GuardConfig,
	BackupData,
} from "./index.js";

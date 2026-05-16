import { exec, execSync, spawnSync } from "node:child_process";

import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// Load version from package.json for schema URL
const require = createRequire(import.meta.url);
const { version: EXTENSION_VERSION } = require("../package.json");
import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

// =============================================================================
// Constants
// =============================================================================

const SETTINGS_PATH = `${homedir()}/.pi/agent/settings.json`;
const NPM_PREFIX = "npm:";
const STATUS_KEY = "ext:pi-pkg-guard:v1";
const CONFIG_KEY = "pi-pkg-guard";
const CORE_PACKAGE = "@earendil-works/pi-coding-agent";
const SELF_PACKAGE = "pi-pkg-guard";
const DEFAULT_BACKUP_PATH = `${homedir()}/.pi/agent/package-guard-backup.json`;
const EXTENSION_SETTINGS_PATH = `${homedir()}/.pi/agent/pi-pkg-guard.json`;

// NPM package detection patterns
// - Starts with 'pi-' (e.g., pi-foo, pi-extmgr)
// - Ends with '-pi' (e.g., lsp-pi)
// - Contains '/pi-' in scope (e.g., @scope/pi-foo)
const PI_NAME_PATTERN = /(^pi-|-pi$|\/pi-)/;
// Keywords that indicate a package is a pi extension
export const PI_KEYWORDS = ["pi-coding-agent", "pi-extension", "pi-package"];

// NPM cache to prevent repeated execSync calls during menu loops
const NPM_CACHE_TTL_MS = 5000; // 5 second cache
let npmGlobalCache: string[] | null = null;
let npmGlobalCacheTime = 0;

// NPM prefix cache (rarely changes)
const NPM_PREFIX_CACHE_TTL_MS = 30000; // 30 second cache
let npmPrefixCache: string | null = null;
let npmPrefixCacheTime = 0;

// Keyword regex cache for isGlobalPiInstall
export const keywordRegexCache = new Map<string, RegExp>();

// npm existence cache (24h TTL) — prevents repeated registry lookups
const NPM_EXISTENCE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const npmExistenceCache = new Map<
	string,
	{ exists: boolean; expiresAt: number }
>();

// Package Snapshot Schema URL (for backup validation)
const PACKAGE_SNAPSHOT_SCHEMA_URL = `https://raw.githubusercontent.com/earendil-works/pi-mono/v${EXTENSION_VERSION}/packages/pi-pkg-guard/schema/package-snapshot.json`;

// Accept schema URLs from any version tag, main branch, or refs/tags pattern
const ALLOWED_SNAPSHOT_SCHEMA_PATTERNS = [
	PACKAGE_SNAPSHOT_SCHEMA_URL,
	/^https:\/\/raw\.githubusercontent\.com\/earendil-works\/pi-mono\/v\d+\.\d+\.\d+\/packages\/pi-pkg-guard\/schema\/package-snapshot\.json$/,
	/^https:\/\/raw\.githubusercontent\.com\/earendil-works\/pi-mono\/refs\/tags\/v\d+\.\d+\.\d+\/packages\/pi-pkg-guard\/schema\/package-snapshot\.json$/,
	"https://raw.githubusercontent.com/earendil-works/pi-mono/refs/heads/main/packages/pi-pkg-guard/schema/package-snapshot.json",
	"https://raw.githubusercontent.com/earendil-works/pi-mono/main/packages/pi-pkg-guard/schema/package-snapshot.json",
];

// =============================================================================
// Types
// =============================================================================

export interface PackageStatus {
	unregistered: string[]; // In npm global, not in settings
	hasUnregistered: boolean;
}

export interface PiSettings {
	packages?: string[];
	extensions?: string[];
}

export interface ExtensionSettings {
	backupPath?: string;
	gistId?: string;
	gistEnabled?: boolean;
	knownKeywordPackages?: string[];
}

export interface PackageSnapshot {
	$schema: string;
	timestamp: string;
	npmPackages: string[];
	excludedPackages?: string[];
}

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

export interface MigrationResult {
	migrated: boolean;
	data?: PackageSnapshot;
	errors?: string[];
}

// Legacy type aliases for backward compatibility
/** @deprecated Use PackageStatus instead */
export type PackageDiff = PackageStatus;
/** @deprecated Use ExtensionSettings instead */
export type GuardConfig = ExtensionSettings;
/** @deprecated Use PackageSnapshot instead */
export type BackupData = PackageSnapshot;

// =============================================================================
// Type Guards
// =============================================================================

export function isPiSettings(value: unknown): value is PiSettings {
	if (typeof value !== "object" || value === null) return false;
	if (Array.isArray(value)) return false;
	const candidate = value as Record<string, unknown>;

	if (candidate.packages !== undefined) {
		if (!Array.isArray(candidate.packages)) return false;
		if (!candidate.packages.every((p) => typeof p === "string")) return false;
	}

	if (candidate.extensions !== undefined) {
		if (!Array.isArray(candidate.extensions)) return false;
		if (!candidate.extensions.every((e) => typeof e === "string")) return false;
	}

	return true;
}

export function isExtensionSettings(
	value: unknown,
): value is ExtensionSettings {
	if (typeof value !== "object" || value === null) return false;
	if (Array.isArray(value)) return false;
	const candidate = value as Record<string, unknown>;

	if (
		candidate.backupPath !== undefined &&
		typeof candidate.backupPath !== "string"
	) {
		return false;
	}
	if (candidate.gistId !== undefined && typeof candidate.gistId !== "string") {
		return false;
	}
	if (
		candidate.gistEnabled !== undefined &&
		typeof candidate.gistEnabled !== "boolean"
	) {
		return false;
	}
	if (candidate.knownKeywordPackages !== undefined) {
		if (!Array.isArray(candidate.knownKeywordPackages)) return false;
		if (!candidate.knownKeywordPackages.every((p) => typeof p === "string"))
			return false;
	}

	return true;
}

export function isBashToolInput(input: unknown): input is { command?: string } {
	if (typeof input !== "object" || input === null) return false;
	if (Array.isArray(input)) return false;
	const candidate = input as Record<string, unknown>;
	if (
		candidate.command !== undefined &&
		typeof candidate.command !== "string"
	) {
		return false;
	}
	return true;
}

/**
 * Validate that a value is a valid PackageSnapshot object.
 * Checks all required fields and their types.
 */
export function isPackageSnapshot(value: unknown): value is PackageSnapshot {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;

	// Check $schema field
	if (typeof v.$schema !== "string") return false;

	// Check timestamp
	if (typeof v.timestamp !== "string") return false;

	// Check npmPackages array
	if (!Array.isArray(v.npmPackages)) return false;
	if (!v.npmPackages.every((p) => typeof p === "string")) return false;

	// excludedPackages is optional
	if (v.excludedPackages !== undefined) {
		if (!Array.isArray(v.excludedPackages)) return false;
		if (!v.excludedPackages.every((p) => typeof p === "string")) return false;
	}

	return true;
}

/**
 * Detect if data is a legacy backup (lacks $schema but has other required fields).
 */
export function isLegacyBackup(data: unknown): boolean {
	if (typeof data !== "object" || data === null) return false;
	if (Array.isArray(data)) return false;

	const candidate = data as Record<string, unknown>;

	// Legacy backup indicators:
	// 1. No $schema field
	// 2. Has timestamp (string)
	// 3. Has npmPackages (array)
	// 4. Has registeredPackages OR unregisteredPackages OR orphanedPackages

	if (candidate.$schema !== undefined) return false;
	if (typeof candidate.timestamp !== "string") return false;
	if (!Array.isArray(candidate.npmPackages)) return false;

	const hasLegacyFields =
		Array.isArray(candidate.registeredPackages) ||
		Array.isArray(candidate.unregisteredPackages) ||
		Array.isArray(candidate.orphanedPackages);

	return hasLegacyFields;
}

/**
 * Migrate a legacy backup to the current schema format.
 */
export function migrateLegacyBackup(data: unknown): MigrationResult {
	if (!isLegacyBackup(data)) {
		return {
			migrated: false,
			errors: [
				"Not a legacy backup - already has $schema or missing required fields",
			],
		};
	}

	const legacy = data as Record<string, unknown>;

	const migrated: PackageSnapshot = {
		$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
		timestamp: legacy.timestamp as string,
		npmPackages: (legacy.npmPackages as string[]) || [],
	};

	// Preserve excludedPackages if present
	if (Array.isArray(legacy.excludedPackages)) {
		migrated.excludedPackages = legacy.excludedPackages as string[];
	}

	return { migrated: true, data: migrated };
}

/**
 * Strictly validate a PackageSnapshot against the schema.
 * Returns detailed error messages if validation fails.
 */
export function validatePackageSnapshot(data: unknown): ValidationResult {
	const errors: string[] = [];

	if (typeof data !== "object" || data === null) {
		return { valid: false, errors: ["Data must be an object"] };
	}

	if (Array.isArray(data)) {
		return { valid: false, errors: ["Data must be an object, not an array"] };
	}

	const candidate = data as Record<string, unknown>;

	// Check $schema field
	if (candidate.$schema === undefined) {
		errors.push("Missing required field: $schema");
	} else if (typeof candidate.$schema !== "string") {
		errors.push("Field '$schema' must be a string");
	} else {
		const isValidSchemaUrl = ALLOWED_SNAPSHOT_SCHEMA_PATTERNS.some((pattern) =>
			typeof pattern === "string"
				? candidate.$schema === pattern
				: pattern.test(candidate.$schema as string),
		);
		if (!isValidSchemaUrl) {
			errors.push(
				`Unrecognized schema URL: '${candidate.$schema}'. Expected a pi-pkg-guard package snapshot schema URL.`,
			);
		}
	}

	// Check timestamp
	if (candidate.timestamp === undefined) {
		errors.push("Missing required field: timestamp");
	} else if (typeof candidate.timestamp !== "string") {
		errors.push("Field 'timestamp' must be a string");
	} else if (Number.isNaN(Date.parse(candidate.timestamp))) {
		errors.push("Field 'timestamp' must be a valid ISO 8601 date-time string");
	}

	// Check npmPackages
	if (candidate.npmPackages === undefined) {
		errors.push("Missing required field: npmPackages");
	} else if (!Array.isArray(candidate.npmPackages)) {
		errors.push("Field 'npmPackages' must be an array");
	} else {
		for (let i = 0; i < candidate.npmPackages.length; i++) {
			if (typeof candidate.npmPackages[i] !== "string") {
				errors.push(`Field 'npmPackages[${i}]' must be a string`);
			}
		}
	}

	// Check excludedPackages (optional)
	if (candidate.excludedPackages !== undefined) {
		if (!Array.isArray(candidate.excludedPackages)) {
			errors.push("Field 'excludedPackages' must be an array");
		} else {
			for (let i = 0; i < candidate.excludedPackages.length; i++) {
				if (typeof candidate.excludedPackages[i] !== "string") {
					errors.push(`Field 'excludedPackages[${i}]' must be a string`);
				}
			}
		}
	}

	// Check for additional properties
	const allowedKeys = [
		"$schema",
		"timestamp",
		"npmPackages",
		"excludedPackages",
	];
	for (const key of Object.keys(candidate)) {
		if (!allowedKeys.includes(key)) {
			errors.push(`Unexpected property: '${key}'`);
		}
	}

	return { valid: errors.length === 0, errors };
}

// =============================================================================
// Gist Utilities
// =============================================================================

/**
 * Extract gist ID from a GitHub Gist URL or return the input if it's already an ID.
 * Supports formats like:
 * - https://gist.github.com/username/abc123def456
 * - https://gist.github.com/abc123def456
 * - abc123def456 (passes through)
 *
 * @param input - URL or gist ID
 * @returns The extracted gist ID or the original input
 */
export function extractGistId(input: string): string {
	const trimmed = input.trim();
	const match = trimmed.match(
		/gist\.github\.com\/(?:[\w-]+\/)?([a-f0-9]{32,})/i,
	);
	return match ? match[1] : trimmed;
}

/**
 * Validate that a gist ID is safe to use in shell commands.
 * Only allows hexadecimal characters to prevent command injection.
 *
 * @param gistId - The gist ID to validate
 * @returns true if the gist ID is valid and safe
 */
export function isValidGistId(gistId: string): boolean {
	// Gist IDs are 32+ character hexadecimal strings
	return /^[a-f0-9]{32,}$/i.test(gistId);
}

/**
 * Validate that a backup path is safe to use for file operations.
 * Only allows paths within ~/.pi/agent/ or os.tmpdir() to prevent path traversal.
 *
 * @param backupPath - The path to validate
 * @returns true if the path is within allowed directories
 */
export function isValidBackupPath(backupPath: string): boolean {
	const resolvedPath = resolve(backupPath);
	const homeDir = homedir();
	const allowedDirs = [
		resolve(join(homeDir, ".pi", "agent")),
		resolve(tmpdir()),
	];

	return allowedDirs.some(
		(allowedDir) =>
			resolvedPath === allowedDir ||
			resolvedPath.startsWith(`${allowedDir}${sep}`),
	);
}

/**
 * Remove npm: prefix from package name if present.
 */
export function normalizePackageName(pkg: string): string {
	return pkg.startsWith(NPM_PREFIX) ? pkg.slice(NPM_PREFIX.length) : pkg;
}

/**
 * Check if a package exists on the npm registry.
 * Returns false only on confirmed 404; treats network errors as "exists" to be safe.
 * Uses spawnSync with array args to avoid shell injection.
 * Results are cached for 24 hours.
 */
function _packageExistsOnNpmImpl(packageName: string): boolean {
	// Check cache first
	const cached = npmExistenceCache.get(packageName);
	if (cached && Date.now() < cached.expiresAt) {
		return cached.exists;
	}

	const result = spawnSync("npm", ["view", packageName, "version"], {
		encoding: "utf-8",
		timeout: 10000,
		stdio: "pipe",
	});

	let exists: boolean;
	if (result.status === 0) {
		exists = true;
	} else {
		const stderr = result.stderr || "";
		// Only consider missing if it's a confirmed 404
		exists = !stderr.includes("E404");
		// Network/auth errors: assume package exists to avoid false removals
	}

	npmExistenceCache.set(packageName, {
		exists,
		expiresAt: Date.now() + NPM_EXISTENCE_CACHE_TTL_MS,
	});
	return exists;
}

// Overridable implementation for testability
let packageExistsOnNpmImpl = _packageExistsOnNpmImpl;

export function packageExistsOnNpm(packageName: string): boolean {
	return packageExistsOnNpmImpl(packageName);
}

/**
 * Override the npm existence checker (for tests only).
 */
export function _setPackageExistsChecker(
	fn: (packageName: string) => boolean,
): void {
	packageExistsOnNpmImpl = fn;
}

/**
 * Async version for use in async contexts.
 */
export async function packageExistsOnNpmAsync(
	packageName: string,
): Promise<boolean> {
	return packageExistsOnNpmImpl(packageName);
}

// =============================================================================
// NPM Operations
// =============================================================================

/**
 * Check if a package has pi-extension keywords in its package.json.
 * Reads local package.json - no network access required.
 * Returns true if keywords include any PI_KEYWORDS.
 */
export function hasPiExtensionKeyword(
	nodeModulesPath: string,
	packageName: string,
): boolean {
	try {
		const pkgJsonPath = `${nodeModulesPath}/${packageName}/package.json`;
		const content = readFileSync(pkgJsonPath, "utf-8");
		const pkg = JSON.parse(content) as { keywords?: string[] };
		const keywords = pkg.keywords || [];
		return keywords.some((kw) => PI_KEYWORDS.includes(kw));
	} catch {
		// If we can't read package.json, rely on name pattern only (return false)
		return false;
	}
}

/**
 * Get the npm global prefix with caching.
 */
function getNpmPrefix(): string {
	const now = Date.now();
	if (npmPrefixCache && now - npmPrefixCacheTime < NPM_PREFIX_CACHE_TTL_MS) {
		return npmPrefixCache;
	}
	const prefix = execSync("npm prefix -g", {
		encoding: "utf-8",
		timeout: 5000,
	}).trim();
	npmPrefixCache = prefix;
	npmPrefixCacheTime = now;
	return prefix;
}

/**
 * Get packages detected via keywords only (not matching naming patterns).
 * Used to auto-populate knownKeywordPackages for npm guard warnings.
 */
export function getKeywordOnlyPackages(): string[] {
	return getNpmGlobalPackages().filter((name) => !PI_NAME_PATTERN.test(name));
}

export function getNpmGlobalPackages(): string[] {
	// Check cache first
	const now = Date.now();
	if (npmGlobalCache && now - npmGlobalCacheTime < NPM_CACHE_TTL_MS) {
		return npmGlobalCache;
	}

	try {
		const output = execSync("npm list -g --json --depth=0", {
			encoding: "utf-8",
			timeout: 30000,
		});

		const parsed = JSON.parse(output) as {
			dependencies?: Record<string, unknown>;
		};
		const deps = parsed.dependencies || {};

		// Get global prefix for reading package.json files
		const globalPrefix = getNpmPrefix();
		const nodeModulesPath = `${globalPrefix}/lib/node_modules`;

		const result = Object.keys(deps).filter(
			(name) =>
				// Exclude core package
				name !== CORE_PACKAGE &&
				// Exclude self (dev mode uses symlink, not npm)
				name !== SELF_PACKAGE &&
				// Include if matches naming pattern OR has pi keywords in package.json
				(PI_NAME_PATTERN.test(name) ||
					hasPiExtensionKeyword(nodeModulesPath, name)),
		);

		// Update cache
		npmGlobalCache = result;
		npmGlobalCacheTime = now;

		return result;
	} catch (error) {
		// Log for debugging but don't break UI flow
		if (process.env.DEBUG) {
			console.error("[pi-pkg-guard] npm list failed:", error);
		}
		return [];
	}
}

/**
 * Pre-seed the npm global cache (for tests only).
 * Avoids expensive `npm list -g` calls in test environments.
 */
export function _resetNpmGlobalCache(packages: string[]): void {
	npmGlobalCache = packages;
	npmGlobalCacheTime = Date.now() + NPM_CACHE_TTL_MS;
}

// =============================================================================
// Settings Operations
// =============================================================================

export function readPiSettings(): PiSettings {
	try {
		const content = readFileSync(SETTINGS_PATH, "utf-8");
		const parsed = JSON.parse(content) as unknown;

		if (!isPiSettings(parsed)) {
			return {};
		}

		return parsed;
	} catch {
		// File doesn't exist or is invalid - return empty settings
		return {};
	}
}

export function readExtensionSettings(): ExtensionSettings {
	// Try dedicated extension settings file first (isolated from pi core)
	let dedicatedConfig: ExtensionSettings | null = null;
	try {
		const content = readFileSync(EXTENSION_SETTINGS_PATH, "utf-8");
		const parsed = JSON.parse(content) as unknown;
		if (isExtensionSettings(parsed)) {
			dedicatedConfig = parsed;
		}
	} catch {
		// Dedicated file doesn't exist or is invalid
	}

	// Legacy fallback: read from settings.json
	try {
		const settings = readPiSettings();
		const config = (settings as Record<string, unknown>)[CONFIG_KEY];

		if (isExtensionSettings(config)) {
			// If dedicated file is empty/minimal, migrate legacy config
			if (!dedicatedConfig || Object.keys(dedicatedConfig).length === 0) {
				try {
					ensureExtensionSettingsDir();
					writeFileSync(
						EXTENSION_SETTINGS_PATH,
						`${JSON.stringify(config, null, 2)}\n`,
					);
				} catch {
					// Migration failure is non-critical
				}
				return config;
			}
		}
	} catch {
		// Ignore
	}

	return dedicatedConfig || {};
}

function ensureExtensionSettingsDir(): void {
	try {
		mkdirSync(dirname(EXTENSION_SETTINGS_PATH), { recursive: true });
	} catch {
		// Ignore - directory may already exist or we lack permissions
	}
}

export function writeExtensionSettings(config: ExtensionSettings): void {
	try {
		ensureExtensionSettingsDir();
		writeFileSync(
			EXTENSION_SETTINGS_PATH,
			`${JSON.stringify(config, null, 2)}\n`,
		);
	} catch (error) {
		// Log but don't throw - this is a non-critical operation
		console.error("[pi-pkg-guard] Failed to write extension settings:", error);
	}
}

/**
 * Get registered packages from settings.json.
 * Normalizes both "npm:pi-foo" and "pi-foo" formats to "pi-foo".
 */
function getRegisteredPackages(): string[] {
	const settings = readPiSettings();
	const packages = settings.packages || [];

	return packages.map((pkg: string) => {
		// Handle both "npm:pi-foo" and "pi-foo" formats
		return pkg.startsWith(NPM_PREFIX) ? pkg.slice(NPM_PREFIX.length) : pkg;
	});
}

/**
 * Write updated settings back to settings.json.
 * Silently fails on error (non-critical operation).
 */
function writePiSettings(settings: PiSettings): void {
	try {
		writeFileSync(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);
	} catch (error) {
		// Log but don't throw - this is a non-critical operation
		console.error("[pi-pkg-guard] Failed to write settings:", error);
	}
}

// =============================================================================
// Package Analysis
// =============================================================================

/**
 * Analyze packages to find orphaned pi extensions.
 * Orphaned = installed via npm but not registered in pi settings.
 *
 * Note: This is a point-in-time snapshot. Race conditions between npm and
 * settings.json reads are acceptable for this non-critical, advisory operation.
 * The menu loop re-analyzes on each iteration for fresh state.
 */
export function checkRegistrationStatus(): PackageStatus {
	const npmPackages = new Set(getNpmGlobalPackages());
	const registeredPackages = new Set(getRegisteredPackages());

	const unregistered = [...npmPackages].filter(
		(pkg) => !registeredPackages.has(pkg),
	);

	return {
		unregistered,
		hasUnregistered: unregistered.length > 0,
	};
}

/**
 * Sync orphaned packages to settings.json.
 * Adds npm: prefix to each orphaned package.
 */
export function registerPackages(status: PackageStatus): void {
	if (status.unregistered.length === 0) return;

	const settings = readPiSettings();
	settings.packages = settings.packages || [];

	// Normalize existing packages and track in Set for O(1) lookups
	const existingPackages = new Set(settings.packages.map(normalizePackageName));

	for (const pkg of status.unregistered) {
		if (!existingPackages.has(pkg)) {
			settings.packages.push(`${NPM_PREFIX}${pkg}`);
			existingPackages.add(pkg);
		}
	}

	writePiSettings(settings);
}

/**
 * Remove orphaned packages from settings.json.
 * A package is orphaned if it's registered with npm: prefix but neither
 * installed locally nor available on the npm registry.
 * Checks are parallelized (max 5 concurrent) to avoid blocking the event loop.
 * Returns the list of removed package refs.
 */
export async function cleanupOrphanedPackages(): Promise<string[]> {
	const settings = readPiSettings();
	if (!settings.packages || settings.packages.length === 0) {
		return [];
	}

	const localPackages = new Set(getNpmGlobalPackages());
	const npmPackages = settings.packages.filter((p) => p.startsWith(NPM_PREFIX));

	// Batch npm checks in parallel, capped at 5 concurrent to avoid rate limits
	const CONCURRENCY = 5;
	const orphaned: string[] = [];

	for (let i = 0; i < npmPackages.length; i += CONCURRENCY) {
		const batch = npmPackages.slice(i, i + CONCURRENCY);
		const results = await Promise.all(
			batch.map(async (pkg) => {
				const normalized = normalizePackageName(pkg);
				// If installed locally, it's valid
				if (localPackages.has(normalized)) return null;
				// If available on npm, it's valid (user may install later)
				const exists = await packageExistsOnNpmAsync(normalized);
				return exists ? null : pkg;
			}),
		);
		orphaned.push(...results.filter((p): p is string => p !== null));
	}

	if (orphaned.length > 0) {
		const removed = new Set(orphaned);
		settings.packages = settings.packages.filter((p) => !removed.has(p));
		writePiSettings(settings);
	}

	return orphaned;
}

// =============================================================================
// Backup Operations
// =============================================================================

/**
 * Create backup data object with current package state.
 */
function createPackageSnapshot(): PackageSnapshot {
	const npmPackages = getNpmGlobalPackages();

	return {
		$schema: PACKAGE_SNAPSHOT_SCHEMA_URL,
		timestamp: new Date().toISOString(),
		npmPackages,
	};
}

/**
 * Save backup to local file.
 */
function saveLocalBackup(backupPath: string): void {
	if (!isValidBackupPath(backupPath)) {
		throw new Error(
			`Invalid backup path: ${backupPath}. Path must be within ~/.pi/agent/ or a temporary directory.`,
		);
	}
	const data = createPackageSnapshot();
	writeFileSync(backupPath, `${JSON.stringify(data, null, 2)}\n`);
}

/**
 * Check if gh CLI is installed.
 */
export function isGhInstalled(): boolean {
	try {
		execSync("gh --version", { encoding: "utf-8", timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Sync backup to GitHub Gist using gh CLI.
 */
export async function syncGistBackup(
	gistId: string,
	data: PackageSnapshot,
): Promise<{ success: boolean; error?: string }> {
	if (!isValidGistId(gistId)) {
		return {
			success: false,
			error:
				"Invalid gist ID format. Gist IDs must be hexadecimal characters only.",
		};
	}

	if (!isGhInstalled()) {
		return {
			success: false,
			error:
				"GitHub CLI (gh) is not installed. Install it from https://cli.github.com or use the local backup only.",
		};
	}

	try {
		// Create isolated temp directory and file for atomic cleanup
		const tmpDir = mkdtempSync(join(tmpdir(), "pkg-guard-"));
		const tempFile = join(tmpDir, "backup.json");
		const content = `${JSON.stringify(data, null, 2)}\n`;
		writeFileSync(tempFile, content);

		// Update the gist file using the temp file (async - non-blocking)
		await execAsync(
			`gh gist edit ${gistId} ${tempFile} --filename "package-guard-backup.json"`,
			{
				timeout: 30000,
			},
		);

		// Clean up temp directory and file
		try {
			rmSync(tmpDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors - OS will clean /tmp eventually
		}

		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Create a new GitHub Gist using gh CLI.
 */
export async function createGist(): Promise<{
	success: boolean;
	gistId?: string;
	error?: string;
}> {
	if (!isGhInstalled()) {
		return {
			success: false,
			error:
				"GitHub CLI (gh) is not installed. Install it from https://cli.github.com",
		};
	}

	try {
		// Create isolated temp directory and file for atomic cleanup
		const tmpDir = mkdtempSync(join(tmpdir(), "pkg-guard-"));
		const tempFile = join(tmpDir, "create.json");
		writeFileSync(tempFile, '{"status": "initial backup"}\n');

		// Create gist using temp file (async - non-blocking)
		const { stdout } = await execAsync(
			`gh gist create --public --filename "package-guard-backup.json" --desc "Package Guard backup" ${tempFile}`,
			{
				timeout: 30000,
			},
		);

		// Clean up temp directory and file
		try {
			rmSync(tmpDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors - OS will clean /tmp eventually
		}

		// Extract gist ID from output URL
		const gistId = extractGistId(stdout);
		if (gistId && gistId !== stdout.trim()) {
			return { success: true, gistId };
		}

		return { success: false, error: "Could not extract gist ID from output" };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Delete a GitHub Gist using gh CLI.
 */
export async function deleteGist(
	gistId: string,
): Promise<{ success: boolean; error?: string }> {
	if (!isValidGistId(gistId)) {
		return {
			success: false,
			error:
				"Invalid gist ID format. Gist IDs must be hexadecimal characters only.",
		};
	}

	if (!isGhInstalled()) {
		return {
			success: false,
			error:
				"GitHub CLI (gh) is not installed. Install it from https://cli.github.com",
		};
	}

	try {
		await execAsync(`gh gist delete ${gistId}`, {
			timeout: 30000,
		});

		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

// ===========================================================================
// Gist Content Retrieval
// ===========================================================================

/**
 * Fetch gist content using gh CLI.
 */
export async function getGistContent(
	gistId: string,
): Promise<{ success: boolean; content?: string; error?: string }> {
	if (!isValidGistId(gistId)) {
		return {
			success: false,
			error:
				"Invalid gist ID format. Gist IDs must be hexadecimal characters only.",
		};
	}

	if (!isGhInstalled()) {
		return {
			success: false,
			error:
				"GitHub CLI (gh) is not installed. Install it from https://cli.github.com",
		};
	}

	try {
		const { stdout } = await execAsync(`gh gist view ${gistId} --raw`, {
			timeout: 30000,
		});

		return { success: true, content: stdout };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

// ===========================================================================
// Unified Command Handler Functions
// ===========================================================================

async function executeScan(
	ctx: ExtensionCommandContext,
	options: { offerReload?: boolean } = {},
): Promise<void> {
	// Clean up orphaned packages first for accurate counts
	const orphaned = await cleanupOrphanedPackages();

	ctx.ui.setWorkingMessage("Scanning npm global packages...");
	const status = checkRegistrationStatus();
	ctx.ui.setWorkingMessage();

	if (orphaned.length > 0) {
		ctx.ui.notify(
			`⚠ Removed ${orphaned.length} orphaned ${orphaned.length === 1 ? "package" : "packages"} from settings:\n${orphaned.map((p) => `  - ${p}`).join("\n")}`,
			"warning",
		);
	}

	if (!status.hasUnregistered) {
		ctx.ui.notify(
			"✓ All pi packages are registered. No unregistered packages found.",
			"info",
		);
		return;
	}

	ctx.ui.notify(
		`Found ${status.unregistered.length} unregistered ${status.unregistered.length === 1 ? "package" : "packages"}:\n${status.unregistered.map((p) => `  - ${p}`).join("\n")}`,
		"warning",
	);

	// For small batches (≤3), auto-register for speed. For larger batches, ask first.
	let packagesToRegister = status.unregistered;
	if (status.unregistered.length > 3) {
		const bulkChoice = await ctx.ui.select(
			`Register all ${status.unregistered.length} unregistered packages?`,
			["Register all", "Choose which to register", "Cancel"],
		);
		if (bulkChoice === "Cancel" || bulkChoice === undefined) {
			ctx.ui.notify("Registration cancelled", "info");
			return;
		}
		if (bulkChoice === "Choose which to register") {
			packagesToRegister = await selectPackages(ctx, status.unregistered);
			if (packagesToRegister.length === 0) {
				ctx.ui.notify("No packages selected for registration", "info");
				return;
			}
		}
	}

	// Safety: auto-backup current state before modifying settings.json
	try {
		const config = readExtensionSettings();
		const backupPath = config.backupPath || DEFAULT_BACKUP_PATH;
		const preRegisterPath = `${backupPath}.pre-register`;
		saveLocalBackup(preRegisterPath);
	} catch {
		// Non-critical: proceed even if backup fails
	}

	// Register selected packages
	const partialStatus: PackageStatus = {
		hasUnregistered: true,
		unregistered: packagesToRegister,
	};
	registerPackages(partialStatus);

	ctx.ui.notify(
		`✓ Registered ${packagesToRegister.length} ${packagesToRegister.length === 1 ? "package" : "packages"} with pi:\n${packagesToRegister.map((p) => `  - npm:${p}`).join("\n")}`,
		"info",
	);

	// Auto-discover and persist keyword-only packages for npm guard warnings
	const keywordOnlyPackages = getKeywordOnlyPackages();
	if (keywordOnlyPackages.length > 0) {
		const config = readExtensionSettings();
		const known = new Set(config.knownKeywordPackages || []);
		const newPackages = keywordOnlyPackages.filter((p) => !known.has(p));
		if (newPackages.length > 0) {
			config.knownKeywordPackages = [...known, ...newPackages];
			writeExtensionSettings(config);
		}
	}

	// Offer reload to activate newly registered packages
	if (options.offerReload) {
		const shouldReload = await ctx.ui.confirm(
			"Reload pi?",
			"Packages are registered but not active until you reload. Reload now?",
		);
		if (shouldReload) {
			ctx.ui.notify("Reloading...", "info");
			await ctx.reload();
			return;
		}
		ctx.ui.notify(
			"Run /reload when ready to activate the registered packages.",
			"info",
		);
	} else {
		ctx.ui.notify("Run /reload to activate the registered packages.", "info");
	}
}

/**
 * Interactive package selector: lets user include/skip each package with bulk options.
 */
async function selectPackages(
	ctx: ExtensionCommandContext,
	packages: string[],
): Promise<string[]> {
	const selected = new Set<string>();
	const remaining = [...packages];

	while (remaining.length > 0) {
		const currentPkg = remaining[0];
		const choice = await ctx.ui.select(
			`Package ${packages.length - remaining.length + 1} of ${packages.length}: ${currentPkg}`,
			[
				"Include this package",
				"Skip this package",
				"Include all remaining",
				"Skip all remaining",
			],
		);

		if (choice === "Include this package") {
			selected.add(currentPkg);
			remaining.shift();
		} else if (choice === "Skip this package") {
			remaining.shift();
		} else if (choice === "Include all remaining") {
			for (const pkg of remaining) {
				selected.add(pkg);
			}
			break;
		} else if (choice === "Skip all remaining") {
			break;
		} else {
			// undefined (escape) = cancel
			break;
		}
	}

	return [...selected];
}

async function executeBackup(ctx: ExtensionCommandContext): Promise<void> {
	const config = readExtensionSettings();
	const data = createPackageSnapshot();
	const backupPath = config.backupPath || DEFAULT_BACKUP_PATH;
	const ghInstalled = isGhInstalled();

	ctx.ui.setWorkingMessage("Saving backup...");

	let localSuccess = false;
	let localError: string | null = null;

	try {
		saveLocalBackup(backupPath);
		localSuccess = true;
	} catch (error) {
		localError = error instanceof Error ? error.message : String(error);
	}

	let gistSuccess = false;
	let gistError: string | null = null;

	if (config.gistId && config.gistEnabled !== false) {
		if (!ghInstalled) {
			gistError =
				"GitHub CLI (gh) is not installed. Install it from https://cli.github.com";
		} else {
			ctx.ui.setWorkingMessage("Syncing to GitHub Gist...");
			const result = await syncGistBackup(config.gistId, data);
			gistSuccess = result.success;
			gistError = result.error || null;
		}
	}

	ctx.ui.setWorkingMessage();

	// Combine all results into a single, clear notification
	if (localSuccess && gistSuccess && config.gistId) {
		ctx.ui.notify(
			`✓ Local backup saved:\n  ${backupPath}\n✓ Synced to GitHub Gist:\n  https://gist.github.com/${config.gistId}`,
			"info",
		);
	} else if (localSuccess && !config.gistId) {
		ctx.ui.notify(`✓ Local backup saved:\n  ${backupPath}`, "info");
	} else if (localSuccess && config.gistId && config.gistEnabled === false) {
		ctx.ui.notify(`✓ Local backup saved:\n  ${backupPath}`, "info");
	} else if (localSuccess && gistError) {
		ctx.ui.notify(
			`✓ Local backup saved\n✗ Gist sync failed:\n${gistError || ""}`,
			"warning",
		);
	} else if (localError) {
		ctx.ui.notify(`✗ Failed to save backup:\n${localError}`, "error");
	}

	// Warn once if gh is missing and user has gist configured
	if (!ghInstalled && config.gistId && config.gistEnabled !== false) {
		ctx.ui.notify(
			"⚠ GitHub CLI (gh) not found. Gist features are disabled. Install from https://cli.github.com",
			"warning",
		);
	}
}

async function executeRestore(ctx: ExtensionCommandContext): Promise<void> {
	const config = readExtensionSettings();
	const backupPath = config.backupPath || DEFAULT_BACKUP_PATH;

	// Validate custom backup paths (default path is always safe)
	if (config.backupPath && !isValidBackupPath(config.backupPath)) {
		ctx.ui.notify(
			`✗ Invalid backup path: ${config.backupPath}.\n\nPath must be within ~/.pi/agent/ or a temporary directory.`,
			"error",
		);
		return;
	}

	let backupData: PackageSnapshot | null = null;
	let backupSource = "local";

	ctx.ui.setWorkingMessage("Reading backup...");

	// Try local backup first
	try {
		const content = readFileSync(backupPath, "utf-8");
		const parsed = JSON.parse(content) as unknown;

		// Check if it's a current schema backup
		if (isPackageSnapshot(parsed) && validatePackageSnapshot(parsed).valid) {
			backupData = parsed;
		}
		// Check if it's a legacy backup
		else if (isLegacyBackup(parsed)) {
			const migration = migrateLegacyBackup(parsed);
			if (migration.migrated && migration.data) {
				// Prompt user to migrate
				const shouldMigrate = await ctx.ui.confirm(
					"Legacy Backup Detected",
					`This backup was created with an older version of Package Guard (${migration.data.timestamp}).\n\nMigrate to current schema format?`,
				);

				if (shouldMigrate) {
					backupData = migration.data;

					// Optionally: upgrade the saved backup file
					const shouldUpgrade = await ctx.ui.confirm(
						"Upgrade Backup File?",
						"Save the migrated backup to replace the legacy version?",
					);

					if (shouldUpgrade) {
						try {
							writeFileSync(
								backupPath,
								`${JSON.stringify(backupData, null, 2)}\n`,
							);
							ctx.ui.notify(
								"✓ Backup upgraded to current schema format",
								"info",
							);
						} catch {
							ctx.ui.notify(
								"⚠ Restore completed but failed to upgrade backup file (read-only?)",
								"warning",
							);
						}
					}
				} else {
					// User declined migration
					ctx.ui.notify(
						"Cannot restore legacy backup without migration. Please upgrade the backup first.",
						"error",
					);
					return;
				}
			}
		}
	} catch {
		// Local backup failed, will try gist
	}

	// Try Gist backup if local failed
	if (!backupData && config.gistId && isGhInstalled()) {
		try {
			const result = await getGistContent(config.gistId);
			if (result.success && result.content) {
				const parsed = JSON.parse(result.content) as unknown;

				if (
					isPackageSnapshot(parsed) &&
					validatePackageSnapshot(parsed).valid
				) {
					backupData = parsed;
					backupSource = "gist";
				} else if (isLegacyBackup(parsed)) {
					const migration = migrateLegacyBackup(parsed);
					if (migration.migrated && migration.data) {
						const shouldMigrate = await ctx.ui.confirm(
							"Legacy Backup Detected",
							`This Gist backup uses the old format (${migration.data.timestamp}).\n\nMigrate to current schema?`,
						);

						if (shouldMigrate) {
							backupData = migration.data;
							backupSource = "gist";
						} else {
							ctx.ui.notify(
								"Cannot restore legacy backup without migration. Please upgrade the backup first.",
								"error",
							);
							return;
						}
					}
				}
			}
		} catch {
			// Gist backup failed too
		}
	}

	ctx.ui.setWorkingMessage();

	if (!backupData) {
		ctx.ui.notify(
			"✗ No backup found.\n\nRun Backup first to create a backup.",
			"error",
		);
		return;
	}

	ctx.ui.notify(
		`✓ Loaded backup from ${backupSource}:\n  ${backupData.timestamp}`,
		"info",
	);

	const currentRegistered = new Set(getRegisteredPackages());
	const packagesToRestore = backupData.npmPackages.filter(
		(pkg) => !currentRegistered.has(pkg),
	);

	if (packagesToRestore.length === 0) {
		ctx.ui.notify(
			`✓ All ${backupData.npmPackages.length} ${backupData.npmPackages.length === 1 ? "package" : "packages"} from backup are already installed.\n\nNo restore needed.`,
			"info",
		);
		return;
	}

	ctx.ui.notify(
		`${packagesToRestore.length} ${packagesToRestore.length === 1 ? "package" : "packages"} from backup not currently registered:\n${packagesToRestore.map((p) => `  - ${p}`).join("\n")}`,
		"info",
	);

	let selectedPackages: string[] = [];

	// Small batches: confirm once. Large batches: offer bulk or granular choice.
	if (packagesToRestore.length <= 3) {
		const confirmed = await ctx.ui.confirm(
			"Restore packages?",
			`Register all ${packagesToRestore.length} ${packagesToRestore.length === 1 ? "package" : "packages"} with pi?`,
		);
		if (!confirmed) {
			ctx.ui.notify("Restore cancelled", "info");
			return;
		}
		selectedPackages = packagesToRestore;
	} else {
		const bulkChoice = await ctx.ui.select(
			`Restore ${packagesToRestore.length} packages from backup?`,
			["Restore all", "Pick individually", "Cancel"],
		);
		if (bulkChoice === "Cancel" || bulkChoice === undefined) {
			ctx.ui.notify("Restore cancelled", "info");
			return;
		}
		if (bulkChoice === "Restore all") {
			selectedPackages = packagesToRestore;
		} else {
			const chosen = await selectPackages(ctx, packagesToRestore);
			if (chosen.length === 0) {
				ctx.ui.notify("No packages selected for restore", "info");
				return;
			}
			selectedPackages = chosen;
		}
	}

	ctx.ui.setWorkingMessage("Restoring packages...");

	const settings = readPiSettings();
	settings.packages = settings.packages || [];

	let added = 0;
	for (const pkg of selectedPackages) {
		const normalized = normalizePackageName(pkg);
		const npmRef = `${NPM_PREFIX}${normalized}`;
		if (!settings.packages.includes(npmRef)) {
			settings.packages.push(npmRef);
			added++;
		}
	}

	writePiSettings(settings);
	ctx.ui.setWorkingMessage();

	const addedPackages = [...selectedPackages].filter((p) => {
		const npmRef = `${NPM_PREFIX}${normalizePackageName(p)}`;
		return settings.packages?.includes(npmRef);
	});

	if (added > 0) {
		const installCmd = `pi install ${addedPackages.map((p) => `${NPM_PREFIX}${normalizePackageName(p)}`).join(" ")}`;
		ctx.ui.notify(
			`✓ Restored ${added} ${added === 1 ? "package" : "packages"} to settings:\n${addedPackages.map((p) => `  - npm:${normalizePackageName(p)}`).join("\n")}\n\nRun this command to install:\n  ${installCmd}`,
			"info",
		);
	} else {
		ctx.ui.notify("✓ All selected packages were already registered.", "info");
	}
}

// =============================================================================
// Menu Loop Helper
// =============================================================================

interface MenuItem {
	label: string;
	action: () => Promise<void>;
	exit?: boolean;
}

/**
 * Run an interactive menu loop with widget status and consistent exit behavior.
 * Clears the widget on Escape or Exit selection.
 */
async function runMenuLoop(
	ctx: ExtensionCommandContext,
	title: string,
	widgetKey: string,
	getWidgetLines: () => string[],
	getMenuItems: () => MenuItem[],
): Promise<void> {
	while (true) {
		ctx.ui.setWidget(widgetKey, getWidgetLines());

		const items = getMenuItems();
		const choice = await ctx.ui.select(
			title,
			items.map((i) => i.label),
		);

		if (choice === undefined) {
			ctx.ui.setWidget(widgetKey, []);
			return;
		}

		const item = items.find((i) => i.label === choice);
		if (!item) {
			continue;
		}

		if (item.exit) {
			ctx.ui.setWidget(widgetKey, []);
			return;
		}

		await item.action();
	}
}

async function executeGistConfig(
	ctx: ExtensionCommandContext,
	config: ExtensionSettings,
): Promise<void> {
	await runMenuLoop(
		ctx,
		"Configure Gist",
		"pi-pkg-guard:gist",
		() => [],
		() => {
			const items: MenuItem[] = [];

			if (!config.gistId) {
				items.push({
					label: `${items.length + 1}. Create Gist`,
					action: async () => {
						ctx.ui.setWorkingMessage("Creating new gist...");
						const result = await createGist();
						ctx.ui.setWorkingMessage();
						if (result.success && result.gistId) {
							config.gistId = result.gistId;
							config.gistEnabled = true;
							writeExtensionSettings(config);
							ctx.ui.notify(
								`Created and configured gist ${result.gistId}`,
								"info",
							);
						} else {
							ctx.ui.notify(
								`Failed to create gist: ${result.error || ""}`,
								"error",
							);
						}
					},
				});
				items.push({
					label: `${items.length + 1}. Connect Gist`,
					action: async () => {
						const gistInput = await ctx.ui.input(
							"GitHub Gist ID or URL (empty to clear):",
							"",
						);
						if (gistInput !== undefined) {
							const trimmed = gistInput.trim();
							config.gistId =
								trimmed === "" ? undefined : extractGistId(trimmed);
							config.gistEnabled = config.gistId ? true : undefined;
							writeExtensionSettings(config);
							ctx.ui.notify(
								config.gistId ? "Gist configured" : "Gist cleared",
								"info",
							);
						}
					},
				});
			} else {
				items.push({
					label: `${items.length + 1}. Switch Gist`,
					action: async () => {
						const gistInput = await ctx.ui.input(
							"GitHub Gist ID or URL (empty to clear):",
							config.gistId ? `https://gist.github.com/${config.gistId}` : "",
						);
						if (gistInput !== undefined) {
							const trimmed = gistInput.trim();
							config.gistId =
								trimmed === "" ? undefined : extractGistId(trimmed);
							if (!config.gistId) {
								config.gistEnabled = undefined;
							}
							writeExtensionSettings(config);
							ctx.ui.notify(
								config.gistId ? "Gist configured" : "Gist cleared",
								"info",
							);
						}
					},
				});
				items.push({
					label: `${items.length + 1}. Disconnect`,
					action: async () => {
						if (!config.gistId) {
							ctx.ui.notify("No gist configured", "warning");
							return;
						}
						const confirmed = await ctx.ui.confirm(
							"Disconnect Gist?",
							`This will remove gist ${config.gistId} from Package Guard. The Gist itself will remain on GitHub.`,
						);
						if (confirmed) {
							config.gistId = undefined;
							config.gistEnabled = undefined;
							writeExtensionSettings(config);
							ctx.ui.notify("Gist disconnected", "info");
						}
					},
				});
			}

			items.push({
				label: `${items.length + 1}. Back`,
				action: async () => {},
				exit: true,
			});

			return items;
		},
	);
}

async function executeConfig(ctx: ExtensionCommandContext): Promise<void> {
	const config = readExtensionSettings();
	const ghInstalled = isGhInstalled();

	await runMenuLoop(
		ctx,
		"Config",
		"pi-pkg-guard:status",
		() => {
			const currentPath = config.backupPath || DEFAULT_BACKUP_PATH;
			const displayPath = currentPath.startsWith(homedir())
				? `~${currentPath.slice(homedir().length)}`
				: currentPath;
			return [
				`💾 ${displayPath} │ ${config.gistId ? `☁️ ${config.gistId}` : "☁️ not configured"} │ ${config.gistId ? (config.gistEnabled === false ? "⏸️ off" : "⏳ on") : "⏸️ off"}`,
			];
		},
		() => {
			const currentPath = config.backupPath || DEFAULT_BACKUP_PATH;
			const items: MenuItem[] = [
				{
					label: "1. Backup path",
					action: async () => {
						const newPath = await ctx.ui.input(
							"Backup file path:",
							currentPath,
						);
						if (newPath !== undefined) {
							const expandedPath = newPath.startsWith("~")
								? `${homedir()}${newPath.slice(1)}`
								: newPath;
							config.backupPath = expandedPath;
							writeExtensionSettings(config);
							ctx.ui.notify("Backup path set", "info");
						}
					},
				},
			];

			if (ghInstalled) {
				items.push({
					label: `${items.length + 1}. Gist...`,
					action: async () => {
						await executeGistConfig(ctx, config);
					},
				});
			}

			items.push({
				label: `${items.length + 1}. Exit`,
				action: async () => {},
				exit: true,
			});

			return items;
		},
	);
}

async function showHelp(ctx: ExtensionCommandContext): Promise<void> {
	// Use pi's UI notification for proper formatting and overflow handling
	const helpLines = [
		"═══ Quick Commands ═══",
		"/package-guard scan     - Scan and register unregistered packages",
		"/package-guard backup   - Backup packages",
		"/package-guard restore  - Restore from backup",
		"/package-guard config   - Open configuration settings",
		"/package-guard help     - Show this help",
		"",
		"═══ Interactive Menu ═══",
		"1. Scan - Find and register missing packages",
		"2. Backup - Save to local file + GitHub Gist",
		"3. Restore - Register packages from backup",
		"4. Config - Backup path, Gist, sync settings",
		"5. Exit",
		"",
		"═══ Pro Tips ═══",
		"• Use 'pi install npm:package' instead of 'npm install -g package'",
		"• Unregistered packages are installed but not tracked by pi",
		"• Gist backup keeps your packages synced across machines",
		"• Run Scan after installing packages via npm",
	];

	ctx.ui.notify(helpLines.join("\n"), "info");
}

// ===========================================================================
// Unified Command: /package-guard
// ===========================================================================

export default function piPkgGuardExtension(pi: ExtensionAPI) {
	// ===========================================================================
	// Startup Check: Detect orphaned packages (max once per hour)
	// ===========================================================================

	pi.on("session_start", async (event, ctx) => {
		if (event.reason !== "startup") return;

		// Clean up orphaned packages that don't exist on npm
		const orphaned = await cleanupOrphanedPackages();
		if (orphaned.length > 0) {
			ctx.ui.notify(
				`⚠ Removed ${orphaned.length} orphaned ${orphaned.length === 1 ? "package" : "packages"} from settings:\n${orphaned.map((p) => `  - ${p}`).join("\n")}`,
				"warning",
			);
		}

		const status = checkRegistrationStatus();
		if (status.hasUnregistered) {
			ctx.ui.setStatus(
				STATUS_KEY,
				`${status.unregistered.length} package${status.unregistered.length === 1 ? "" : "s"} to register. Run /package-guard`,
			);
		}
	});

	// ===========================================================================
	// Unified Command: /package-guard
	// ===========================================================================

	pi.registerCommand("package-guard", {
		description:
			"Package Guard - manage unregistered packages, backup, and restore",
		handler: async (_args, ctx) => {
			// Subcommand routing for power users: /package-guard <scan|backup|restore|config|help>
			const subcommand = (_args || "").trim().toLowerCase();
			if (subcommand === "scan") {
				await executeScan(ctx, { offerReload: true });
				return;
			}
			if (subcommand === "backup") {
				await executeBackup(ctx);
				return;
			}
			if (subcommand === "restore") {
				await executeRestore(ctx);
				return;
			}
			if (subcommand === "config") {
				await executeConfig(ctx);
				return;
			}
			if (subcommand === "help" || subcommand === "?") {
				await showHelp(ctx);
				return;
			}

			await runMenuLoop(
				ctx,
				"Package Guard",
				"pi-pkg-guard:status",
				() => {
					const config = readExtensionSettings();
					const registeredPackages = getRegisteredPackages();
					const status = checkRegistrationStatus();
					const currentPath = config.backupPath || DEFAULT_BACKUP_PATH;
					const gistDisplay = config.gistId
						? `☁️ ${config.gistId}`
						: "☁️ not configured";
					const syncDisplay = config.gistEnabled === false ? "⏸️ off" : "⏳ on";
					const pathDisplay =
						currentPath === DEFAULT_BACKUP_PATH ? "local" : "custom";
					const unregisteredSummary = status.hasUnregistered
						? status.unregistered.length <= 3
							? `🔧 ${status.unregistered.join(", ")}`
							: `🔧 ${status.unregistered.length}`
						: "✓";
					return [
						`📦 ${registeredPackages.length} │ ${unregisteredSummary} │ 💾 ${pathDisplay} │ ${gistDisplay} ${syncDisplay}`,
					];
				},
				() => {
					const status = checkRegistrationStatus();
					const scanLabel = status.hasUnregistered
						? `🔧 Register ${status.unregistered.length}`
						: "Scan";
					return [
						{
							label: `1. ${scanLabel}`,
							action: () => executeScan(ctx, { offerReload: true }),
						},
						{
							label: "2. Backup",
							action: () => executeBackup(ctx),
						},
						{
							label: "3. Restore",
							action: () => executeRestore(ctx),
						},
						{
							label: "4. Config",
							action: () => executeConfig(ctx),
						},
						{
							label: "5. Exit",
							action: async () => {},
							exit: true,
						},
					];
				},
			);
		},
	});

	// ===========================================================================
	// npm Guard: Warn on direct npm install of pi packages
	// ===========================================================================

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return;

		const input = event.input;
		if (!isBashToolInput(input)) return;

		const command = input.command || "";
		const config = readExtensionSettings();
		const { isMatch, packageName } = isGlobalPiInstall(
			command,
			config.knownKeywordPackages,
		);

		if (isMatch && packageName) {
			ctx.ui.notify(
				`Use 'pi install npm:${packageName}' instead of 'npm install -g'`,
				"warning",
			);
		}
	});
}

// Detect npm install with -g or --global and a pi-* package
export const NPM_GLOBAL_PATTERN =
	/npm\s+(?:install|i)(?:\s+\S+)*\s+(?:-g|--global)\b/;
// Matches: pi-foo (start), lsp-pi (end), @scope/pi-foo (scoped), @scope/lsp-pi (scoped with suffix)
export const PI_PACKAGE_PATTERN =
	/(?:^|\s|\/|@)pi-[a-z0-9-]+|(?:^|\s|\/|@)[a-z0-9-]+-pi(?:\s|$|@)/;

/**
 * Check if a bash command is a global npm install of a pi package.
 * Also checks against known keyword-only packages for complete coverage.
 */
export function isGlobalPiInstall(
	command: string,
	knownKeywordPackages: string[] = [],
): {
	isMatch: boolean;
	packageName?: string;
} {
	if (!NPM_GLOBAL_PATTERN.test(command)) {
		return { isMatch: false };
	}

	const match = command.match(PI_PACKAGE_PATTERN);
	if (match) {
		// Clean up the match - remove leading/trailing spaces and slashes
		let packageName = match[0].trim();
		if (packageName.startsWith("/")) {
			packageName = packageName.slice(1);
		}
		// For scoped packages, extract just the package name (after the last /)
		if (packageName.includes("/")) {
			packageName = packageName.split("/").pop() || packageName;
		}
		return { isMatch: true, packageName };
	}

	// Check against known keyword-only packages using pre-compiled regex
	if (knownKeywordPackages.length > 0) {
		const cacheKey = knownKeywordPackages.join(",");
		let keywordPattern = keywordRegexCache.get(cacheKey);
		if (!keywordPattern) {
			const escaped = knownKeywordPackages
				.map((pkg) => pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
				.join("|");
			keywordPattern = new RegExp(`(?:^|\\s)(?:${escaped})(?:\\s|$|@)`);
			keywordRegexCache.set(cacheKey, keywordPattern);
		}
		if (keywordPattern.test(command)) {
			// Find which package matched
			for (const pkg of knownKeywordPackages) {
				if (command.includes(pkg)) {
					return {
						isMatch: true,
						packageName: pkg.split("/").pop() || pkg,
					};
				}
			}
		}
	}

	return { isMatch: false };
}

/**
 * Translation Template - en-US
 *
 * Use this as a starting point for new translations.
 * Copy this file to extensions/i18n/{locale}.ts and translate all values.
 *
 * Requirements:
 * - Keep all keys exactly as shown
 * - Only translate the string values
 * - Maintain ICU MessageFormat syntax: {variable} and {count, plural, one {} other {}}
 */

import type { TranslationDict } from "./types.js";

export const en_US_template: TranslationDict = {
	// ========== STARTUP DETECTION ==========
	startup: {
		warning: "{count} package(s) to register. Run /package-guard",
	},

	// ========== NPM INSTALL GUARD ==========
	npm_guard: {
		warning: "Use 'pi install npm:{packageName}' instead of 'npm install -g'",
	},

	// ========== MANUAL SCAN ==========
	scan: {
		success:
			"✓ Registered {count} unregistered {count, plural, one {package} other {packages}} with pi:",
		none: "✓ All pi packages are registered. No unregistered packages found.",
		reloading: "Run /reload to activate packages",
		error: "✗ Error scanning packages: {error}",
	},

	// ========== BACKUP ==========
	backup: {
		localSuccess: "✓ Local backup saved: {path}",
		gistSuccess: "✓ Synced to GitHub Gist: {gistUrl}",
		gistCreateSuccess: "✓ Created GitHub Gist: {gistUrl}",
		gistDeleteSuccess: "✓ Deleted GitHub Gist and removed configuration",
		gistDisabled: "✓ Gist backup sync off",
		gistEnabled: "✓ Gist backup sync on",
		error: "✗ Backup failed: {error}",
	},

	// ========== RESTORE ==========
	restore: {
		noBackup: "No backup file found at {path}",
		allRegistered:
			"✓ All {count} package(s) from backup are already registered. No restore needed.",
		selectPrompt: "Include {packageName}?",
		include: "Include",
		skip: "Skip",
		includeAll: "Include All",
		skipAll: "Skip All",
		done: "✓ Registered {count} package(s) from backup",
		installCommand: "Run this command to install: pi install {packages}",
	},

	// ========== MENU ==========
	menu: {
		title: "Package Guard",
		scan: "Scan",
		backup: "Backup",
		restore: "Restore",
		changePath: "Backup path",
		gistCreate: "Create Gist",
		gistUse: "Connect Gist",
		gistChange: "Switch Gist",
		gistDelete: "Disconnect",
		gistDisable: "Gist backup off",
		gistEnable: "Gist backup on",
		help: "Help",
		exit: "Exit",
		sectionOperations: "═══ Package Operations ═══",
		sectionConfig: "═══ Configuration ═══",
		sectionSystem: "═══ System ═══",
	},

	// ========== ERRORS ==========
	errors: {
		gistValidation: "Invalid Gist ID. Must be 32+ hexadecimal characters.",
		pathValidation:
			"Invalid path. Must be within ~/.pi/agent/ or temp directory.",
		gistNotFound:
			"Gist not found. Check the ID and your GitHub authentication.",
		gistNoGh: "GitHub CLI (gh) is required for Gist operations.",
		npmFailed: "Failed to get npm packages: {error}",
		settingsFailed: "Failed to read pi settings: {error}",
	},

	// ========== HELP ==========
	help: {
		intro:
			"Package Guard helps you manage pi extensions and prevent unregistered packages.",
		whatAreOrphans: "What are unregistered packages?",
		whatAreOrphansDesc:
			"Unregistered packages are pi extensions installed via npm but not registered in pi's settings. They exist on your system but pi doesn't know about them.",
		howToAvoid: "How to avoid creating unregistered packages",
		howToAvoidDesc:
			"Always use 'pi install npm:package-name' instead of 'npm install -g package-name'. This ensures pi tracks your packages correctly.",
		actions: "Available Actions",
		scanHelp: "Scan - Find and register unregistered packages automatically",
		backupHelp: "Backup - Save your package list locally and to GitHub Gist",
		restoreHelp: "Restore - Selectively restore packages from backup",
		proTips: "Pro Tips",
		proTip1: "Use GitHub Gist backup for multi-machine sync",
		proTip2: "Run scan after any manual npm installations",
		proTip3: "Keep backups current - create one after installing new packages",
	},
};

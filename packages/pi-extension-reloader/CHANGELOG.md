# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-24

### Added

- `/rebuild-extension <name>` command: rebuilds webview, clears jiti cache, and reloads Pi runtime
- Automatic jiti cache directory discovery via env var, common paths, or deep temp scan
- Filename + content heuristics for matching extension cache files
- npm package safety guard — skips rebuild for `node_modules/` extensions
- Path traversal rejection for bare names containing separators
- Persistent rebuild status via `pi.appendEntry("rebuild-status", ...)` so the record survives reload

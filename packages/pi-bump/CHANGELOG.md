# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.4] - 2026-05-16

### Changed

- Refined nudge message pool to pure continue/keep-going variations; removed directional prompts like "Go deeper", "Expand on this", etc.

## [0.2.0] - 2026-05-16

### Changed

- Replaced hardcoded "Bump" message with 16 randomized nudge variations to avoid version-bump ambiguity and repetition fatigue

## [0.1.0] - 2026-05-16

### Added

- Double-Enter detection on empty editor sends "Bump" message
- Guard against firing while streaming or when messages are pending
- Basic integration test coverage

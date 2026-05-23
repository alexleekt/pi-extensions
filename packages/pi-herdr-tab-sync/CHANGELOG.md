# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-05-19

### Added

- Consume `pi-heading` `heading:state` events to sync heading topic to herdr tab labels.
- Tab updates on both session resume and heading topic changes.

## [1.0.0] - 2026-05-16

### Added

- Initial release: sync pi session name to herdr tab label.
- Automatic tab renaming on `agent_start` when session name has changed.
- Only activates inside herdr-managed panes (`HERDR_ENV=1`).

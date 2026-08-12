# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-08-12

Initial release.

### Added

- Nine execution-surface scanners: `vscode-tasks`, `vscode-settings`,
  `devcontainer`, `npm-lifecycle`, `git-hooks`, `git-config`, `direnv`,
  `agent-hooks`, and `mcp`.
- Capability-first model: every finding records what runs, when it fires
  (trigger), and where control lands (boundary), with an optional risk overlay
  of documented, provably-suspicious command signals.
- Legible severity grading with the guarantee that an honest repository (tested
  against a clean husky + `node-gyp` fixture) raises no `high` or `medium`
  findings.
- Terminal, JSON, and SARIF 2.1.0 output. `--min` and `--fail-on` thresholds for
  use as a CI gate.
- Tolerant JSONC reader (comments, trailing commas) and a minimal TOML subset
  reader, both with line anchoring, and a control-character stripper for
  untrusted report text.

[Unreleased]: https://github.com/hamodywe/pretrust/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/hamodywe/pretrust/releases/tag/v0.1.0

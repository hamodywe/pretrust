# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] — 2026-08-12

### Added

- **`--diff <ref>`** — report only the execution paths a change adds relative to a
  git ref, read through git plumbing (read-only, nothing executed). Correct for
  subdirectories of a repository, not only the repo root.
- **`--baseline <file>` / `--update-baseline`** — record accepted paths and fail
  only on new ones, the lint-baseline pattern applied to execution surfaces.
- **`python-startup` surface** — `sitecustomize.py`, `usercustomize.py`, and
  `conftest.py`, which run at Python interpreter startup / pytest collection.
- **`pretrust explain [surface]`** — describes what each surface is, when it fires,
  where control lands, and a citation for the trigger.

### Changed

- Finding identity (`findingKey`) is line-independent, so moving a hostile entry
  within a file is recognised as the same path by `--diff` and `--baseline`.

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

[Unreleased]: https://github.com/hamodywe/pretrust/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/hamodywe/pretrust/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/hamodywe/pretrust/releases/tag/v0.1.0

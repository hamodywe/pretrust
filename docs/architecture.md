# Architecture

pretrust is small on purpose. The whole tool is a pipeline from a directory to a
sorted list of facts, with a risk overlay applied along the way.

```
directory ──▶ walk ──▶ files + read ──▶ surfaces ──▶ findings ──▶ sort ──▶ render
                                              │
                                    analyzeCommand (risk overlay)
                                              │
                                        gradeSeverity
```

## The model (`src/model.ts`)

Everything is expressed in one small vocabulary:

- **Trigger** — *when* a path executes relative to obtaining the repo: `folder-open`,
  `agent-session`, `container-init`, `directory-enter`, `install`, `git-op`,
  `interpreter-start`.
- **Boundary** — *where* control lands: `host`, `container`, `agent`.
- **Gate** — what stands between clone and execution: `none`, `workspace-trust`,
  `shell-allow`, `install-step`, `git-action`. Reported honestly; a one-click gate
  is still a gate, but it is a routine click.
- **Signal** — a provably-suspicious trait found inside a command (the risk overlay).
- **Finding** — one execution path, located (file + line) and classified, with its
  evidence and any signals.

A `Finding` is deliberately a statement of fact plus an optional judgement. The
fact (there is a folder-open task here, running this command) is always reported;
the judgement (this command downloads and pipes into a shell) is the overlay.

## Surfaces (`src/surfaces/`)

Each surface is a pure function:

```ts
interface Surface {
  id: string;
  scan(files: string[], read: (f: string) => string | null):
    { findings: Finding[]; unreadable: { file: string; reason: string }[] };
}
```

It receives the list of repo-relative paths and a bounded reader, decides which
files it cares about, and returns findings. It performs no I/O of its own — which
is what makes the whole tool deterministic and each surface testable with a
synthetic file map, no disk required.

Ten surfaces ship today; see the table in the [README](../README.md#surfaces).

Because a surface is pure over `(files, read)`, the same scanners run over a
different *source* of files just by swapping the `RepoScan`. `--diff` uses this: a
git-backed `RepoScan` (`src/git/tree.ts`) reads a base ref through `git ls-tree` /
`git show`, so `diffFindings` can report exactly the paths a change adds. Findings
are matched by a line-independent `findingKey`, which also backs the `--baseline`
allowlist (`src/baseline.ts`).

## The risk overlay (`src/signals/command.ts`)

A command string is inert text until something runs it. `analyzeCommand` asks a
narrow, answerable question — does this command do one of the specific things
droppers do and honest build steps do not — and returns zero or more `Signal`s.
Every detector is a documented regular expression, tuned to be *specific*: the
cost of a false positive (firing on `npm run build`) is that people stop reading
the output, so the detectors err toward silence.

`host-escape` and `auto-approve` are surface-level signals (a devcontainer
`initializeCommand` runs on the host; a setting disables confirmation) rather than
command-text signals, but they live in the same overlay.

## Severity (`src/severity.ts`)

One blunt, legible function turns `(boundary, gate, trigger, signals)` into a
severity:

- A **strong** signal on the host → `high` (in a container → `medium`).
- A **host-escape** with nothing stronger → `medium`.
- Otherwise it is inventory: `low` when it fires on open, `info` for install/git
  paths, nudged up one step if a weak signal (like `os-branch`) is present.

The guarantee this encodes, asserted by the clean-fixture test, is that an honest
repository produces a map and no `high`/`medium` findings.

## The walk (`src/scan/fs.ts`)

A synchronous, symlink-refusing directory walk. It skips `node_modules` and other
VCS/heavy directories, and skips `.git` — with two deliberate exceptions,
`.git/config` and `.git/hooks/*`, which are exactly the parts of `.git` an archive
can weaponise. The reader is bounded (1 MB) and rejects path traversal.

## Parsers (`src/parse/`)

- **JSONC** — the editor and agent config files permit comments and trailing
  commas. Comments and trailing commas are blanked *in place* (replaced with
  spaces, newlines preserved) so line numbers survive, and quote state is tracked
  so a `//` inside a URL string is not mistaken for a comment.
- **TOML** — a documented subset, enough to read `.codex/config.toml` (tables,
  dotted headers, string/number/bool scalars, single-line string arrays). Anything
  it does not model is preserved as a raw string rather than guessed at.

## Reports (`src/report/`)

Three renderers over the same `ScanResult`: a human terminal report (inventory
framing, severity-coloured markers), `--json` (a stable documented shape), and
`--sarif` (2.1.0, one rule per surface, for GitHub code scanning). All untrusted
strings pass through `plain()`, which strips terminal control characters so a
scanned file cannot rewrite the report about it.

## Why deterministic matters

The orchestrator sorts findings by severity, then file, then line, so two runs over
the same tree produce byte-identical output. That is not a nicety — it is what lets
pretrust be a CI gate whose result a reviewer can trust and diff.

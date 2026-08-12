# Roadmap

Direction, not promises. Ordered roughly by value-to-effort. The bar for anything
here is the same as everywhere in this project: a finding must be a provable fact
about a file.

## Near term

- **More surfaces, each with a documented trigger citation.**
  - JetBrains `.idea/` external tools and run configurations that trigger on open.
  - `.vscode/extensions.json` recommendations paired with extensions that act on
    open (reported as context, not execution).
  - Python `sitecustomize.py` / `usercustomize.py` and `.pth` files on the path —
    interpreter-start execution.
  - Makefile / Taskfile default targets invoked by editor "run on open" plugins.
- **`--baseline` / allowlist.** Record the accepted execution paths for a repo you
  maintain, so CI only fails on *new* ones — the same idea as a lint baseline.
- **`--diff` mode.** Given two revisions, report only the execution paths a change
  *adds*. This is the form most useful on a pull request: "this PR adds a
  folder-open task."

## Medium term

- **Config-driven severity policy.** Let a team declare, e.g., that any `host`
  boundary `agent-session` path is `high` for them, without patching the tool.
- **Richer git coverage.** `.gitattributes` clean/smudge filter *drivers* (paired
  with the config that defines them), submodule hook inheritance.
- **A `pretrust explain <surface>` command** that prints the trigger semantics and
  the citation, so the tool teaches the threat model as you use it.

## Explicitly out of scope

- **Executing anything.** pretrust will always be a static reader.
- **Prompt-injection / agent-rules analysis.** That is instruction, not code
  execution, and a different tool's job.
- **Reputation or signature matching.** Recognising known-bad indicators is a
  losing race pretrust intentionally does not run; it maps capability instead.

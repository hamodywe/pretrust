# Roadmap

Direction, not promises. Ordered roughly by value-to-effort. The bar for anything
here is the same as everywhere in this project: a finding must be a provable fact
about a file.

## Shipped in 0.2.0

- ~~`--diff` mode~~ — report only the execution paths a change adds versus a ref.
- ~~`--baseline` / allowlist~~ — fail only on paths new relative to a recorded set.
- ~~Python interpreter-start surface~~ — `sitecustomize.py`, `usercustomize.py`,
  `conftest.py`.
- ~~`pretrust explain`~~ — the tool teaches its own threat model.

## Near term

- **More surfaces, each with a documented trigger citation.**
  - JetBrains `.idea/` external tools and run configurations that trigger on open.
  - `.vscode/extensions.json` recommendations paired with extensions that act on
    open (reported as context, not execution).
  - Python `.pth` files that carry an `import` line — but only once we can prove
    the trigger (they execute from a site directory, not a plain checkout).
  - Makefile / Taskfile default targets invoked by editor "run on open" plugins.

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

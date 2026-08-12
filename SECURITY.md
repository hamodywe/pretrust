# Security Policy

## Scope

pretrust is a **static reader**. It opens files, parses them, and prints a report.
It never executes anything it scans, never resolves or expands variables, and never
follows a command into the script it invokes. It makes no network calls. Running
`pretrust` against a hostile repository is safe by design; that is the whole point.

Two capabilities beyond reading, both explicit and narrow: `--diff` shells out to
`git` plumbing (`ls-tree`, `show`) to read a base revision — read-only, and it never
runs content from the repository; `--update-baseline` writes a JSON file to the path
you name. Neither is engaged unless you pass the corresponding flag.

Report text taken from a scanned repository (evidence lines, notes, file paths) is
stripped of terminal control characters before display, so a crafted config cannot
rewrite the report about itself.

## What pretrust does *not* protect you from

Read [the Limitations section of the README](README.md#limitations) before relying
on a clean report. In short: pretrust maps capability, not intent. A malicious
payload that carries no risk signal will appear in the inventory as an ordinary
`info` path. A clean `pretrust` run means "here is everything that will run" — not
"this repository is safe."

## Reporting a vulnerability

If you find a way to make pretrust execute code, escape its own scan boundary
(read outside the target directory), crash on a crafted input, or misreport a real
execution path as absent, please report it privately:

- Open a [GitHub security advisory](https://github.com/hamodywe/pretrust/security/advisories/new), or
- email the maintainer listed on the GitHub profile.

Please include the input that triggers it. We aim to acknowledge within a few days.

A **false negative** — an execution surface or trigger pretrust should model and
does not — is treated as a security issue, not merely a feature request, because a
missed path is the failure mode that matters most for this tool.

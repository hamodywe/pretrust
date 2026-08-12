# Contributing to pretrust

Thanks for considering a contribution. pretrust has an unusually specific quality
bar, and holding to it is what makes the tool worth running.

## The one rule that matters

**A finding must be a provable fact about a file, not a guess about intent.**

pretrust's entire value proposition is that it reports capability deterministically
— "this `tasks.json` *will* run on folder open" — rather than scoring how suspicious
something looks. If a proposed check cannot be stated as a fact about the file's
contents, it belongs in a different tool.

A corollary: **every new surface ships with a fixture it is supposed to stay silent
on.** A check that fires on the correct, common case is worse than no check, because
it trains people to scroll past the real thing. The clean fixture
(`test/fixtures/clean`) exists precisely to catch this, and the suite asserts it
raises no `high` or `medium` findings.

## Adding a surface

1. Add `src/surfaces/<name>.ts` exporting a `Surface`. Keep it pure:
   `(files, read) → { findings, unreadable }`. No filesystem access inside the
   scanner — the walker provides everything.
2. Classify each finding: `trigger` (when it fires), `boundary` (where control
   lands), `gate` (what stands between clone and execution). Let `gradeSeverity`
   assign severity; don't hand-pick it.
3. Route command strings through `analyzeCommand` for the risk overlay rather than
   inventing new ad-hoc pattern matching.
4. Register it in `src/scan/scan.ts` and add a rule name in `src/report/sarif.ts`.
5. Add tests in `test/surfaces.test.ts`, and add both a hostile and a clean case
   to the fixtures.

## Development

```bash
npm install
npm run build      # tsc -> dist/
npm run typecheck  # strict, no emit
npm test           # builds, then runs node --test against dist/
```

Tests run against the built `dist/` output and spawn the real CLI binary as a
process — an in-process CLI test can pass while silently swallowing a failure, so
we don't do that.

## Commit style

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`
in imperative mood, lowercase, no trailing period. The body explains *why*.

```
feat(surfaces): add a scanner for JetBrains external tools
fix(json): keep a comma inside a string from being read as a trailing comma
```

## Reporting a surface we miss

If you know of a config file that runs code on open, install, or a routine git or
agent action and pretrust does not cover it, please open an issue with the exact
file, the key, and the documentation that says when it fires. That last part — a
citation for the trigger — is what lets us model it as a fact.

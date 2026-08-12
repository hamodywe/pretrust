/**
 * Python code that runs when the interpreter starts — before any of the project's
 * own modules are imported deliberately.
 *
 *   - `sitecustomize.py` / `usercustomize.py` are imported automatically by
 *     CPython at startup if they are importable. The directory you launch Python
 *     from is commonly on `sys.path` (running `python`, or `python script.py`
 *     which prepends the script's directory), so a copy sitting in a repo you are
 *     working in gets imported the next time you run Python there.
 *   - `conftest.py` is imported by pytest during test collection — running the
 *     test suite of an untrusted repository executes every `conftest.py` in it
 *     before a single test function runs.
 *
 * The trigger is reported as `interpreter-start` in all three cases, with a note
 * that names the precise condition, because honesty about *when* it fires is the
 * whole value of the classification.
 */
import { analyzeCommand } from '../signals/command.js';
import type { Finding, Surface } from '../model.js';
import { gradeSeverity } from '../severity.js';
import { evidenceOf } from './util.js';

interface PyFile {
  readonly name: string;
  readonly note: string;
}

const AUTO_IMPORTED: readonly PyFile[] = [
  {
    name: 'sitecustomize.py',
    note: 'Imported automatically at Python startup when this directory is on sys.path.',
  },
  {
    name: 'usercustomize.py',
    note: 'Imported automatically at Python startup when this directory is on sys.path.',
  },
  {
    name: 'conftest.py',
    note: 'Imported by pytest during test collection — runs before any test function.',
  },
];

/** First substantive, non-comment line for evidence. */
function firstStatement(raw: string): { line: number; text: string } {
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (t === '' || t.startsWith('#')) continue;
    return { line: i + 1, text: t };
  }
  return { line: 1, text: lines[0] ?? '' };
}

function basename(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1);
}

export const pythonStartup: Surface = {
  id: 'python-startup',
  scan(files, read) {
    const findings: Finding[] = [];
    const names = new Set(AUTO_IMPORTED.map((p) => p.name));

    for (const file of files) {
      const name = basename(file);
      if (!names.has(name)) continue;
      const spec = AUTO_IMPORTED.find((p) => p.name === name)!;

      const raw = read(file);
      if (raw === null) continue;

      const { line, text } = firstStatement(raw);
      const signals = analyzeCommand(raw);
      const severity = gradeSeverity('host', 'none', 'interpreter-start', signals);

      findings.push({
        surface: this.id,
        title: `Python ${name} runs at interpreter startup`,
        trigger: 'interpreter-start',
        boundary: 'host',
        gate: 'none',
        severity,
        file,
        line,
        evidence: evidenceOf(text),
        signals,
        note: spec.note,
      });
    }

    return { findings, unreadable: [] };
  },
};

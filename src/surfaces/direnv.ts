/**
 * `.envrc` — direnv runs this shell script the moment a shell enters the
 * directory, gated by a one-time `direnv allow`. The gate is real, which is why
 * the surface reports it as `shell-allow`; the point is that the file is
 * arbitrary shell, not just environment exports, and the allow is a habit.
 */
import { analyzeCommand } from '../signals/command.js';
import type { Finding, Surface } from '../model.js';
import { gradeSeverity } from '../severity.js';
import { evidenceOf, pickByName } from './util.js';

/** First substantive line for evidence, skipping blanks and comments. */
function firstLine(raw: string): { line: number; text: string } {
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (t === '' || t.startsWith('#')) continue;
    return { line: i + 1, text: t };
  }
  return { line: 1, text: lines[0] ?? '' };
}

export const direnv: Surface = {
  id: 'direnv',
  scan(files, read) {
    const findings: Finding[] = [];

    for (const file of pickByName(files, '.envrc')) {
      const raw = read(file);
      if (raw === null) continue;

      const { line, text } = firstLine(raw);
      const signals = analyzeCommand(raw);
      const severity = gradeSeverity('host', 'shell-allow', 'directory-enter', signals);

      findings.push({
        surface: this.id,
        title: 'direnv .envrc runs on entering the directory',
        trigger: 'directory-enter',
        boundary: 'host',
        gate: 'shell-allow',
        severity,
        file,
        line,
        evidence: evidenceOf(text),
        signals,
        note: 'Runs as shell on your machine each time you cd in, once `direnv allow` is given.',
      });
    }

    return { findings, unreadable: [] };
  },
};

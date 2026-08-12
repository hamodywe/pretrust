/**
 * Human-facing report. The framing is an inventory first and an alarm second:
 * the header states how many execution paths exist, and each entry says plainly
 * when it fires and where control lands. Severity colours the marker, but even a
 * low or info entry is meant to be read — the value of the tool is the complete
 * map, not only the red lines.
 */
import type { Finding, ScanResult, Severity, Trigger } from '../model.js';
import { plain } from './plain.js';
import type { Style } from './style.js';

const TRIGGER_LABEL: Record<Trigger, string> = {
  'folder-open': 'when the folder is opened',
  'agent-session': 'when an agent session starts',
  'container-init': 'when the dev container is built',
  'directory-enter': 'when you cd into the directory',
  install: 'during dependency install',
  'git-op': 'on a git operation',
  'interpreter-start': 'when the interpreter loads',
};

function marker(severity: Severity, style: Style): string {
  switch (severity) {
    case 'high':
      return style.red('●');
    case 'medium':
      return style.yellow('●');
    case 'low':
      return style.blue('●');
    case 'info':
      return style.dim('○');
  }
}

function severityWord(severity: Severity, style: Style): string {
  const w = severity.toUpperCase().padEnd(6);
  switch (severity) {
    case 'high':
      return style.red(style.bold(w));
    case 'medium':
      return style.yellow(w);
    case 'low':
      return style.blue(w);
    case 'info':
      return style.dim(w);
  }
}

function countBy(findings: readonly Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

function summaryLine(counts: Record<Severity, number>, style: Style): string {
  const parts: string[] = [];
  if (counts.high) parts.push(style.red(`${counts.high} high`));
  if (counts.medium) parts.push(style.yellow(`${counts.medium} medium`));
  if (counts.low) parts.push(style.blue(`${counts.low} low`));
  if (counts.info) parts.push(style.dim(`${counts.info} info`));
  return parts.join(style.dim(' · '));
}

export function renderTerminal(result: ScanResult, style: Style): string {
  const { findings } = result;
  const lines: string[] = [];
  lines.push('');
  lines.push(`  ${style.bold('pretrust')} ${style.dim(plain(result.root))}`);
  lines.push('');

  if (findings.length === 0) {
    lines.push(`  ${style.green('No auto-execution paths found.')}`);
    lines.push(
      style.dim(
        '  Nothing in this repository runs on open, install, or a git action without you asking.',
      ),
    );
    lines.push('');
    return lines.join('\n');
  }

  const counts = countBy(findings);
  const total = findings.length;
  lines.push(
    `  ${style.bold(String(total))} execution path${total === 1 ? '' : 's'} that run without you asking  ${style.dim('—')}  ${summaryLine(counts, style)}`,
  );
  lines.push('');

  for (const f of findings) {
    lines.push(
      `  ${marker(f.severity, style)} ${severityWord(f.severity, style)} ${style.cyan(f.surface)}  ${style.dim(`${plain(f.file)}:${f.line}`)}`,
    );
    lines.push(`      ${plain(f.title)}`);
    lines.push(
      style.dim(
        `      runs ${TRIGGER_LABEL[f.trigger]} · lands on ${f.boundary} · gate: ${f.gate}`,
      ),
    );
    if (f.evidence) lines.push(`      ${style.dim('$')} ${plain(f.evidence)}`);
    for (const s of f.signals) {
      lines.push(`      ${style.yellow('!')} ${plain(s.detail)}`);
    }
    lines.push(style.dim(`      ${plain(f.note)}`));
    lines.push('');
  }

  if (result.unreadable.length > 0) {
    lines.push(style.dim(`  ${result.unreadable.length} file(s) matched a surface but could not be parsed:`));
    for (const u of result.unreadable) {
      lines.push(style.dim(`    ${plain(u.file)} — ${plain(u.reason)}`));
    }
    lines.push('');
  }

  return lines.join('\n');
}

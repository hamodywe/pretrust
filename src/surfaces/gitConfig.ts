/**
 * `.git/config` directives that run commands. This file is not version-controlled
 * on a normal clone, so a copy of it in the checkout means the repository was
 * delivered whole — an archive or a nested repo — and its settings are live.
 *
 * Three directives execute code: `core.hooksPath` redirects git at a hook
 * directory that ships in the tree; `core.fsmonitor` set to a command (rather
 * than the built-in `true`) runs that command on routine git operations, the
 * indirection at the heart of the Cursor open-repo escape; and an `alias` whose
 * value begins with `!` is a shell command run when that git subcommand is used.
 */
import { analyzeCommand } from '../signals/command.js';
import type { Finding, Signal, Surface } from '../model.js';
import { gradeSeverity } from '../severity.js';
import { evidenceOf, pickByName } from './util.js';

interface ConfigEntry {
  readonly section: string;
  readonly key: string;
  readonly value: string;
  readonly line: number;
}

/** Parse the git-config INI subset: sections, subsections, `key = value`. */
function parseGitConfig(raw: string): ConfigEntry[] {
  const entries: ConfigEntry[] = [];
  const lines = raw.split('\n');
  let section = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      // `[remote "origin"]` -> `remote.origin`; `[core]` -> `core`
      const inner = sectionMatch[1]!.trim();
      const sub = inner.match(/^(\S+)\s+"(.*)"$/);
      section = sub ? `${sub[1]!.toLowerCase()}.${sub[2]}` : inner.toLowerCase();
      continue;
    }

    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    entries.push({ section, key, value, line: i + 1 });
  }

  return entries;
}

export const gitConfig: Surface = {
  id: 'git-config',
  scan(files, read) {
    const findings: Finding[] = [];
    const unreadable: { file: string; reason: string }[] = [];

    for (const file of pickByName(files, '.git/config')) {
      const raw = read(file);
      if (raw === null) continue;

      let entries: ConfigEntry[];
      try {
        entries = parseGitConfig(raw);
      } catch (e) {
        unreadable.push({ file, reason: (e as Error).message });
        continue;
      }

      for (const e of entries) {
        const section = e.section.split('.')[0];

        if (section === 'core' && e.key === 'hookspath') {
          findings.push({
            surface: this.id,
            title: 'git core.hooksPath points at an in-tree hook directory',
            trigger: 'git-op',
            boundary: 'host',
            gate: 'git-action',
            severity: gradeSeverity('host', 'git-action', 'git-op', []),
            file,
            line: e.line,
            evidence: evidenceOf(`core.hooksPath = ${e.value}`),
            signals: [],
            note: `Git will run hooks from "${e.value}" — check that directory's scripts.`,
          });
          continue;
        }

        if (section === 'core' && e.key === 'fsmonitor' && !/^(true|false)$/i.test(e.value)) {
          const signals: Signal[] = [
            { kind: 'host-escape', detail: 'runs a command on routine git operations' },
            ...analyzeCommand(e.value),
          ];
          findings.push({
            surface: this.id,
            title: 'git core.fsmonitor runs an external command',
            trigger: 'git-op',
            boundary: 'host',
            gate: 'git-action',
            severity: gradeSeverity('host', 'git-action', 'git-op', signals),
            file,
            line: e.line,
            evidence: evidenceOf(`core.fsmonitor = ${e.value}`),
            signals,
            note: 'This command runs on git status and other everyday operations.',
          });
          continue;
        }

        if (section === 'alias' && e.value.startsWith('!')) {
          const command = e.value.slice(1).trim();
          const signals = analyzeCommand(command);
          findings.push({
            surface: this.id,
            title: `git alias runs a shell command (${e.key})`,
            trigger: 'git-op',
            boundary: 'host',
            gate: 'git-action',
            severity: gradeSeverity('host', 'git-action', 'git-op', signals),
            file,
            line: e.line,
            evidence: evidenceOf(`${e.key} = ${e.value}`),
            signals,
            note: `Runs when someone uses \`git ${e.key}\`.`,
          });
        }
      }
    }

    return { findings, unreadable };
  },
};

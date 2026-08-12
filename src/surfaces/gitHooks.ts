/**
 * Git hooks that ride along in the checkout.
 *
 * A plain `git clone` deliberately does *not* install the remote's `.git/hooks`,
 * which is why hooks feel safe. Two things defeat that: version-controlled hook
 * directories that a setup step wires in with `git config core.hooksPath`
 * (`.husky/`, `.githooks/`), and repositories delivered as an archive or zip that
 * carries a populated `.git/hooks/` directory. Both run scripts on ordinary git
 * actions — `post-checkout` fires immediately after checkout, `pre-commit` on
 * every commit — so they are reported by which action triggers them.
 */
import { analyzeCommand } from '../signals/command.js';
import type { Finding, Signal, Surface } from '../model.js';
import { gradeSeverity } from '../severity.js';
import { evidenceOf, pickChildren } from './util.js';

const HOOK_NAMES = new Set([
  'applypatch-msg',
  'pre-applypatch',
  'post-applypatch',
  'pre-commit',
  'pre-merge-commit',
  'prepare-commit-msg',
  'commit-msg',
  'post-commit',
  'pre-rebase',
  'post-checkout',
  'post-merge',
  'pre-push',
  'pre-receive',
  'update',
  'post-update',
  'post-rewrite',
  'pre-auto-gc',
  'push-to-checkout',
  'sendemail-validate',
  'fsmonitor-watchman',
]);

/** Line of the first non-comment, non-shebang command in a hook script. */
function firstCommandLine(raw: string): { line: number; text: string } {
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (t === '' || t.startsWith('#') || t.startsWith('. ') || t.startsWith('source ')) continue;
    return { line: i + 1, text: t };
  }
  return { line: 1, text: lines[0] ?? '' };
}

function hookBasename(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1);
}

export const gitHooks: Surface = {
  id: 'git-hooks',
  scan(files, read) {
    const findings: Finding[] = [];
    const unreadable: { file: string; reason: string }[] = [];

    const seen = new Set<string>();
    const consider = (file: string, shipped: boolean) => {
      if (seen.has(file)) return;
      const name = hookBasename(file);
      if (name.endsWith('.sample')) return;
      if (!HOOK_NAMES.has(name) && !shipped) return; // husky/githooks: only real hook names
      seen.add(file);

      const raw = read(file);
      if (raw === null) return;

      const { line, text } = firstCommandLine(raw);
      const signals: Signal[] = analyzeCommand(raw);
      if (shipped) {
        signals.unshift({
          kind: 'host-escape',
          detail: 'ships inside a .git directory that a plain clone would not create',
        });
      }
      const severity = gradeSeverity('host', 'git-action', 'git-op', signals);

      findings.push({
        surface: this.id,
        title: shipped
          ? `Git hook shipped in .git/hooks (${name})`
          : `Git hook runs on ${name.startsWith('post-') || name.startsWith('pre-') ? 'a git action' : 'commit'} (${name})`,
        trigger: 'git-op',
        boundary: 'host',
        gate: 'git-action',
        severity,
        file,
        line,
        evidence: evidenceOf(text),
        signals,
        note: shipped
          ? `A populated .git/hooks in the tree runs on git operations — ${name} is not a sample.`
          : `Runs on your machine during the matching git action — ${name} hook.`,
      });
    };

    // Version-controlled hook directories wired in via core.hooksPath.
    for (const dir of ['.husky', '.githooks', 'githooks']) {
      for (const file of pickChildren(files, dir)) {
        // Husky's own helper scripts and the v9 `_` directory are not hooks.
        if (file.includes('/_/') || hookBasename(file).startsWith('.')) continue;
        consider(file, false);
      }
    }

    // A repository delivered with a real .git directory (archive / zip).
    for (const file of pickChildren(files, '.git/hooks')) consider(file, true);

    return { findings, unreadable };
  },
};

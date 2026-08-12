/**
 * `package.json` install lifecycle scripts. `preinstall`, `install`,
 * `postinstall` and `prepare` run automatically during `npm install` — before a
 * single line of the project's own code is imported. This is the oldest
 * auto-execution surface in the ecosystem and still the most heavily abused; the
 * Shai-Hulud npm worm propagated through exactly these hooks.
 *
 * Ordinary packages use `postinstall` to build a native addon and `prepare` to
 * compile TypeScript, so the surface is loud by nature. It stays in the
 * inventory as `info` unless the command itself carries a risk signal — the
 * whole reason the command analyser is specific rather than broad.
 */
import { asObject, parseJsonc } from '../parse/json.js';
import { analyzeCommand } from '../signals/command.js';
import type { Finding, Surface } from '../model.js';
import { gradeSeverity } from '../severity.js';
import { evidenceOf } from './util.js';

const INSTALL_HOOKS = ['preinstall', 'install', 'postinstall', 'prepare'] as const;

export const npmLifecycle: Surface = {
  id: 'npm-lifecycle',
  scan(files, read) {
    const findings: Finding[] = [];
    const unreadable: { file: string; reason: string }[] = [];

    const manifests = files.filter((f) => f === 'package.json' || f.endsWith('/package.json'));

    for (const file of manifests) {
      const raw = read(file);
      if (raw === null) continue;

      let doc;
      try {
        doc = parseJsonc(raw);
      } catch (e) {
        unreadable.push({ file, reason: (e as Error).message });
        continue;
      }

      const root = asObject(doc.value);
      const scripts = root && asObject(root['scripts']);
      if (!scripts) continue;

      for (const hook of INSTALL_HOOKS) {
        const command = scripts[hook];
        if (typeof command !== 'string' || command.trim() === '') continue;

        const signals = analyzeCommand(command);
        const severity = gradeSeverity('host', 'install-step', 'install', signals);

        findings.push({
          surface: this.id,
          title: `npm ${hook} script runs on install`,
          trigger: 'install',
          boundary: 'host',
          gate: 'install-step',
          severity,
          file,
          line: doc.lineContaining(`"${hook}"`),
          evidence: evidenceOf(command),
          signals,
          note: `Runs on your machine during \`npm install\` — ${hook} script.`,
        });
      }
    }

    return { findings, unreadable };
  },
};

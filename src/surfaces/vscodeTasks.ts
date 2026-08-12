/**
 * `.vscode/tasks.json` — a task with `runOptions.runOn: "folderOpen"` executes
 * the moment the workspace is opened. VS Code gates this behind Workspace Trust
 * and a one-time "allow automatic tasks" prompt, so the gate is reported as
 * `workspace-trust` rather than `none` — but once a developer clicks trust, the
 * command runs on their host on every open, with no per-task confirmation. This
 * is the mechanism the Shai-Hulud worm used for persistence and the vector of
 * the January 2026 campaign that compromised 21 contributors' repositories.
 */
import { asArray, asObject, parseJsonc } from '../parse/json.js';
import { analyzeCommand } from '../signals/command.js';
import type { Finding, Surface } from '../model.js';
import { gradeSeverity } from '../severity.js';
import { commandString, evidenceOf, pickByName } from './util.js';

export const vscodeTasks: Surface = {
  id: 'vscode-tasks',
  scan(files, read) {
    const findings: Finding[] = [];
    const unreadable: { file: string; reason: string }[] = [];

    for (const file of pickByName(files, '.vscode/tasks.json')) {
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
      const tasks = root && asArray(root['tasks']);
      if (!tasks) continue;

      let searchFrom = 0;
      for (const t of tasks) {
        const task = asObject(t);
        if (!task) continue;
        const runOptions = asObject(task['runOptions']);
        if (!runOptions || runOptions['runOn'] !== 'folderOpen') continue;

        const command = commandString(task['command'], task['args']);
        const label = typeof task['label'] === 'string' ? task['label'] : '(unlabelled)';
        const proof = command ?? `task "${label}" with dependsOn`;

        const signals = command ? analyzeCommand(command) : [];
        const severity = gradeSeverity('host', 'workspace-trust', 'folder-open', signals);
        const line = doc.lineContaining('folderOpen', searchFrom) || doc.lineContaining(label);
        searchFrom = raw.indexOf('folderOpen', searchFrom) + 1 || searchFrom;

        findings.push({
          surface: this.id,
          title: 'VS Code task runs on folder open',
          trigger: 'folder-open',
          boundary: 'host',
          gate: 'workspace-trust',
          severity,
          file,
          line,
          evidence: evidenceOf(proof),
          signals,
          note:
            'Executes on your machine as soon as the folder is opened and trusted — ' +
            `task "${label}".`,
        });
      }
    }

    return { findings, unreadable };
  },
};

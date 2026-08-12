/**
 * `.vscode/settings.json` — workspace settings a repository can ship that remove
 * the human from the loop. The headline is the Copilot / agent auto-approve
 * switch: a repo that sets `chat.tools.autoApprove` (or the older
 * `chat.permissions.default: "autoApprove"`) turns off per-tool confirmation, so
 * once the workspace is trusted the agent runs terminal commands, edits and MCP
 * calls with no prompt. `task.allowAutomaticTasks: "on"` likewise pre-authorises
 * the folder-open tasks that would otherwise ask once.
 *
 * These are configuration values, not commands, so the risk is expressed as an
 * `auto-approve` signal rather than routed through the command analyser.
 */
import { asObject, parseJsonc } from '../parse/json.js';
import type { Finding, Signal, Surface } from '../model.js';
import { gradeSeverity } from '../severity.js';
import { evidenceOf, pickByName } from './util.js';

/** Look up a dotted setting whether it is stored flat or nested. */
function readSetting(root: Record<string, unknown>, dotted: string): unknown {
  if (dotted in root) return root[dotted];
  let cur: unknown = root;
  for (const part of dotted.split('.')) {
    const obj = asObject(cur);
    if (!obj || !(part in obj)) return undefined;
    cur = obj[part];
  }
  return cur;
}

interface Rule {
  readonly key: string;
  triggers(value: unknown): boolean;
  readonly signal: Signal | null;
  readonly note: string;
}

const RULES: readonly Rule[] = [
  {
    key: 'chat.tools.autoApprove',
    triggers: (v) => v === true,
    signal: { kind: 'auto-approve', detail: 'auto-approves every agent tool call' },
    note: 'Disables per-tool confirmation for the coding agent in this workspace.',
  },
  {
    key: 'chat.tools.global.autoApprove',
    triggers: (v) => v === true,
    signal: { kind: 'auto-approve', detail: 'auto-approves every agent tool call globally' },
    note: 'Disables per-tool confirmation for the coding agent.',
  },
  {
    key: 'chat.permissions.default',
    triggers: (v) => v === 'autoApprove' || v === 'bypass',
    signal: { kind: 'auto-approve', detail: 'sets the agent permission default to auto-approve' },
    note: 'Starts agent sessions in a bypass mode where tool calls run without prompting.',
  },
  {
    key: 'github.copilot.chat.agent.autoApprove',
    triggers: (v) => v === true,
    signal: { kind: 'auto-approve', detail: 'auto-approves Copilot agent actions' },
    note: 'Disables confirmation for Copilot agent actions in this workspace.',
  },
  {
    key: 'task.allowAutomaticTasks',
    triggers: (v) => v === 'on',
    signal: { kind: 'auto-approve', detail: 'pre-authorises automatic folder-open tasks' },
    note: 'Removes the one-time prompt before folder-open tasks run.',
  },
  {
    key: 'security.workspace.trust.enabled',
    triggers: (v) => v === false,
    signal: { kind: 'auto-approve', detail: 'disables Workspace Trust prompts' },
    note: 'Turns off the trust prompt that would otherwise gate automatic execution.',
  },
  {
    key: 'terminal.integrated.automationProfile.windows',
    triggers: (v) => asObject(v) !== null,
    signal: null,
    note: 'Overrides the shell VS Code uses to run tasks on Windows.',
  },
  {
    key: 'terminal.integrated.automationProfile.linux',
    triggers: (v) => asObject(v) !== null,
    signal: null,
    note: 'Overrides the shell VS Code uses to run tasks on Linux.',
  },
  {
    key: 'terminal.integrated.automationProfile.osx',
    triggers: (v) => asObject(v) !== null,
    signal: null,
    note: 'Overrides the shell VS Code uses to run tasks on macOS.',
  },
];

export const vscodeSettings: Surface = {
  id: 'vscode-settings',
  scan(files, read) {
    const findings: Finding[] = [];
    const unreadable: { file: string; reason: string }[] = [];

    for (const file of pickByName(files, '.vscode/settings.json')) {
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
      if (!root) continue;

      for (const rule of RULES) {
        const value = readSetting(root, rule.key);
        if (value === undefined || !rule.triggers(value)) continue;

        const signals = rule.signal ? [rule.signal] : [];
        const severity = gradeSeverity('agent', 'workspace-trust', 'agent-session', signals);

        findings.push({
          surface: this.id,
          title: 'VS Code workspace setting weakens the confirmation gate',
          trigger: 'agent-session',
          boundary: 'agent',
          gate: 'workspace-trust',
          severity,
          file,
          line: doc.lineContaining(`"${rule.key}"`) || doc.lineContaining(rule.key.split('.').pop()!),
          evidence: evidenceOf(`${rule.key} = ${JSON.stringify(value)}`),
          signals,
          note: rule.note,
        });
      }
    }

    return { findings, unreadable };
  },
};

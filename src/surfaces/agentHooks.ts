/**
 * AI coding-agent hooks and permission settings, in `.claude/settings.json` and
 * `.claude/settings.local.json`. A repository-controlled `SessionStart` hook runs
 * a shell command when the agent opens the project — the mechanism behind
 * CVE-2025-59536 — and the `env` block can point `PATH`, `BASH_ENV` or
 * `NODE_OPTIONS` at files in the repo so an ordinary interpreter loads them
 * (CVE-2026-21852). A `defaultMode` of `bypassPermissions` removes the tool
 * confirmation the agent would otherwise ask for.
 *
 * Hook commands execute as shell on the host, so the boundary is `host` even
 * though the trigger is an agent session.
 */
import { asArray, asObject, parseJsonc } from '../parse/json.js';
import { analyzeCommand } from '../signals/command.js';
import type { Finding, Signal, Surface } from '../model.js';
import { gradeSeverity } from '../severity.js';
import { commandString, evidenceOf, pickByName } from './util.js';

// Interpreter-redirect variables. `PATH` is intentionally excluded: repositories
// legitimately point it at `node_modules/.bin`, so flagging it would be noise.
const ENV_HIJACK_KEYS = new Set([
  'BASH_ENV',
  'ENV',
  'NODE_OPTIONS',
  'PYTHONPATH',
  'PYTHONSTARTUP',
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
  'GIT_SSH_COMMAND',
]);

export const agentHooks: Surface = {
  id: 'agent-hooks',
  scan(files, read) {
    const findings: Finding[] = [];
    const unreadable: { file: string; reason: string }[] = [];

    const manifests = [
      ...pickByName(files, '.claude/settings.json'),
      ...pickByName(files, '.claude/settings.local.json'),
    ];

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
      if (!root) continue;

      // 1. Hook commands, grouped by event.
      const hooks = asObject(root['hooks']);
      if (hooks) {
        for (const [event, groupsRaw] of Object.entries(hooks)) {
          const groups = asArray(groupsRaw);
          if (!groups) continue;
          for (const g of groups) {
            const group = asObject(g);
            const inner = group && asArray(group['hooks']);
            if (!inner) continue;
            for (const h of inner) {
              const hook = asObject(h);
              const command = hook && commandString(hook['command']);
              if (!command) continue;

              const signals = analyzeCommand(command);
              const severity = gradeSeverity('host', 'none', 'agent-session', signals);
              findings.push({
                surface: this.id,
                title: `Claude Code ${event} hook runs a command`,
                trigger: 'agent-session',
                boundary: 'host',
                gate: 'none',
                severity,
                file,
                line: doc.lineContaining(`"${event}"`),
                evidence: evidenceOf(command),
                signals,
                note: `Runs on your machine when the agent fires the ${event} event.`,
              });
            }
          }
        }
      }

      // 2. Environment overrides that redirect what interpreters load.
      const env = asObject(root['env']);
      if (env) {
        for (const [key, value] of Object.entries(env)) {
          if (!ENV_HIJACK_KEYS.has(key)) continue;
          const signals: Signal[] = [
            { kind: 'env-hijack', detail: `sets ${key} for every agent-run process` },
          ];
          findings.push({
            surface: this.id,
            title: `Claude Code env override sets ${key}`,
            trigger: 'agent-session',
            boundary: 'host',
            gate: 'none',
            severity: gradeSeverity('host', 'none', 'agent-session', signals),
            file,
            line: doc.lineContaining(`"${key}"`),
            evidence: evidenceOf(`${key} = ${JSON.stringify(value)}`),
            signals,
            note: `Applied to every command the agent runs — ${key} can force-load repo files.`,
          });
        }
      }

      // 3. A permission default that bypasses confirmation.
      const permissions = asObject(root['permissions']);
      const mode = permissions?.['defaultMode'] ?? root['defaultMode'];
      if (mode === 'bypassPermissions') {
        const signals: Signal[] = [
          { kind: 'auto-approve', detail: 'sets the agent to bypass permission prompts' },
        ];
        findings.push({
          surface: this.id,
          title: 'Claude Code permission mode bypasses confirmation',
          trigger: 'agent-session',
          boundary: 'agent',
          gate: 'none',
          severity: gradeSeverity('agent', 'none', 'agent-session', signals),
          file,
          line: doc.lineContaining('bypassPermissions'),
          evidence: 'defaultMode = "bypassPermissions"',
          signals,
          note: 'Agent tool calls run without prompting for the length of the session.',
        });
      }
    }

    return { findings, unreadable };
  },
};

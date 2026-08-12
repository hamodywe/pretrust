/**
 * SARIF 2.1.0 output for GitHub code scanning. Severity maps to SARIF levels:
 * high -> error, medium -> warning, low and info -> note. Each surface becomes a
 * rule so findings group sensibly in the Security tab.
 */
import type { ScanResult, Severity } from '../model.js';
import { SURFACES } from '../scan/scan.js';

const LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = {
  high: 'error',
  medium: 'warning',
  low: 'note',
  info: 'note',
};

const RULE_NAME: Record<string, string> = {
  'vscode-tasks': 'VS Code folder-open task',
  'vscode-settings': 'VS Code confirmation-weakening setting',
  devcontainer: 'Dev container lifecycle command',
  'npm-lifecycle': 'npm install lifecycle script',
  'python-startup': 'Python interpreter-startup file',
  'git-hooks': 'Git hook',
  'git-config': 'Git config execution directive',
  direnv: 'direnv .envrc',
  'agent-hooks': 'AI agent hook or permission',
  mcp: 'Auto-started MCP server',
};

export function renderSarif(result: ScanResult, version: string): string {
  const rules = SURFACES.map((s) => ({
    id: s.id,
    name: RULE_NAME[s.id] ?? s.id,
    shortDescription: { text: RULE_NAME[s.id] ?? s.id },
    helpUri: 'https://github.com/hamodywe/pretrust#surfaces',
  }));

  const results = result.findings.map((f) => {
    const message =
      `${f.title}. Runs ${f.trigger}, lands on ${f.boundary}. ${f.note}` +
      (f.signals.length ? ` Signals: ${f.signals.map((s) => s.detail).join('; ')}.` : '');

    const location =
      f.line >= 1
        ? {
            physicalLocation: {
              artifactLocation: { uri: f.file },
              region: { startLine: f.line },
            },
          }
        : { physicalLocation: { artifactLocation: { uri: f.file } } };

    return {
      ruleId: f.surface,
      level: LEVEL[f.severity],
      message: { text: message },
      locations: [location],
      properties: {
        severity: f.severity,
        trigger: f.trigger,
        boundary: f.boundary,
        gate: f.gate,
        evidence: f.evidence,
        signals: f.signals.map((s) => s.kind),
      },
    };
  });

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'pretrust',
            informationUri: 'https://github.com/hamodywe/pretrust',
            version,
            rules,
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

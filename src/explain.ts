/**
 * `pretrust explain [surface]` — the tool teaching its own threat model. Each
 * entry states what the surface is, when it fires, where control lands, and a
 * citation for the trigger, so a user learns *why* a finding matters rather than
 * only that it exists.
 */
import type { Style } from './report/style.js';
import { SURFACES } from './scan/scan.js';

export interface SurfaceDoc {
  readonly id: string;
  readonly what: string;
  readonly fires: string;
  readonly lands: string;
  readonly citation: string;
}

export const SURFACE_DOCS: readonly SurfaceDoc[] = [
  {
    id: 'vscode-tasks',
    what: 'A .vscode/tasks.json task marked to run on folder open.',
    fires: 'The instant the workspace is opened and Workspace Trust is granted.',
    lands: 'The host machine (your shell).',
    citation: 'VS Code tasks docs (runOptions.runOn); microsoft/vscode #309406; Shai-Hulud persistence.',
  },
  {
    id: 'vscode-settings',
    what: 'A workspace setting that turns off agent tool confirmation or the trust prompt.',
    fires: 'When a coding-agent session starts in the trusted workspace.',
    lands: "The agent's tool loop (which typically reaches the host).",
    citation: 'chat.tools.autoApprove / chat.permissions.default; Repello "Workspace Trust is not AI consent".',
  },
  {
    id: 'devcontainer',
    what: 'A dev container lifecycle command. initializeCommand is the notable one.',
    fires: 'While the dev container is built or started.',
    lands: 'The host for initializeCommand; inside the container for the rest.',
    citation: 'containers.dev json_reference — initializeCommand runs "on the host machine".',
  },
  {
    id: 'npm-lifecycle',
    what: 'A package.json preinstall/install/postinstall/prepare script.',
    fires: 'During `npm install`, before any project code is imported.',
    lands: 'The host machine.',
    citation: 'npm scripts docs; Shai-Hulud npm worm propagation.',
  },
  {
    id: 'python-startup',
    what: 'sitecustomize.py, usercustomize.py, or conftest.py.',
    fires: 'When Python starts with this dir on sys.path, or when pytest collects tests.',
    lands: 'The host machine.',
    citation: 'CPython site module (site/usercustomize); pytest conftest.py collection.',
  },
  {
    id: 'git-hooks',
    what: 'A version-controlled hook (.husky/, .githooks/) or one shipped in .git/hooks.',
    fires: 'On the matching git action — post-checkout on checkout, pre-commit on commit.',
    lands: 'The host machine.',
    citation: 'git hooks docs; a plain clone does not install .git/hooks, but core.hooksPath dirs do.',
  },
  {
    id: 'git-config',
    what: 'A .git/config core.hooksPath, a command core.fsmonitor, or a shell alias.',
    fires: 'On routine git operations (fsmonitor runs on status).',
    lands: 'The host machine.',
    citation: 'git config docs; core.fsmonitor indirection featured in the Cursor open-repo escape.',
  },
  {
    id: 'direnv',
    what: 'A .envrc shell script.',
    fires: 'When you cd into the directory, after a one-time `direnv allow`.',
    lands: 'The host machine.',
    citation: 'direnv docs — .envrc is arbitrary shell, not just environment exports.',
  },
  {
    id: 'agent-hooks',
    what: 'A .claude/settings.json hook, env override, or bypass permission mode.',
    fires: 'When the coding agent starts a session or fires an event.',
    lands: 'The host (hook commands) or the agent (permission mode).',
    citation: 'CVE-2025-59536 (SessionStart hook); CVE-2026-21852 (env exfiltration).',
  },
  {
    id: 'mcp',
    what: 'A local (stdio) MCP server definition with a command.',
    fires: 'When the agent or editor opens the project and launches the server.',
    lands: 'The host machine.',
    citation: '.mcp.json / .vscode/mcp.json / .cursor/mcp.json / .codex/config.toml server definitions.',
  },
];

export function renderExplain(surfaceId: string | undefined, style: Style): string {
  const lines: string[] = [''];

  const docs = surfaceId
    ? SURFACE_DOCS.filter((d) => d.id === surfaceId)
    : SURFACE_DOCS;

  if (surfaceId && docs.length === 0) {
    const known = SURFACES.map((s) => s.id).join(', ');
    lines.push(`  ${style.red(`Unknown surface "${surfaceId}".`)}`);
    lines.push(style.dim(`  Known surfaces: ${known}`));
    lines.push('');
    return lines.join('\n');
  }

  if (!surfaceId) {
    lines.push(`  ${style.bold('pretrust surfaces')} ${style.dim('— what runs, when, and where')}`);
    lines.push('');
  }

  for (const d of docs) {
    lines.push(`  ${style.bold(style.cyan(d.id))}`);
    lines.push(`      ${d.what}`);
    lines.push(style.dim(`      fires:    ${d.fires}`));
    lines.push(style.dim(`      lands on: ${d.lands}`));
    lines.push(style.dim(`      why:      ${d.citation}`));
    lines.push('');
  }

  return lines.join('\n');
}

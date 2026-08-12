/**
 * Auto-started MCP servers. When an agent or editor opens a project, a local
 * (stdio) MCP server defined in the repo is launched as a child process — its
 * `command` runs on the host with no prompt. Config lives in several places with
 * two shapes: `mcpServers` (`.mcp.json`, `.cursor/mcp.json`, `.gemini/settings.json`),
 * `servers` (`.vscode/mcp.json`), and `[mcp_servers.*]` tables in
 * `.codex/config.toml`. Codex's `notify` program is included too, as it also runs
 * on the host in response to agent events.
 *
 * Servers defined purely by a remote URL do not launch a local process and are
 * left out — this surface reports code that runs on your machine, not every
 * server the agent can reach.
 */
import { asArray, asObject, parseJsonc } from '../parse/json.js';
import { parseToml } from '../parse/toml.js';
import { analyzeCommand } from '../signals/command.js';
import type { Finding, Surface } from '../model.js';
import { gradeSeverity } from '../severity.js';
import { commandString, evidenceOf, pickByName } from './util.js';

function serverFinding(
  surfaceId: string,
  file: string,
  name: string,
  command: string,
  line: number,
): Finding {
  const signals = analyzeCommand(command);
  return {
    surface: surfaceId,
    title: `MCP server auto-starts a local process (${name})`,
    trigger: 'agent-session',
    boundary: 'host',
    gate: 'none',
    severity: gradeSeverity('host', 'none', 'agent-session', signals),
    file,
    line,
    evidence: evidenceOf(command),
    signals,
    note: `Launched on your machine when the project is opened — MCP server "${name}".`,
  };
}

export const mcp: Surface = {
  id: 'mcp',
  scan(files, read) {
    const findings: Finding[] = [];
    const unreadable: { file: string; reason: string }[] = [];

    const jsonHosts = [
      ...pickByName(files, '.mcp.json'),
      ...pickByName(files, '.vscode/mcp.json'),
      ...pickByName(files, '.cursor/mcp.json'),
      ...pickByName(files, '.gemini/settings.json'),
    ];

    for (const file of jsonHosts) {
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
      const servers = asObject(root['mcpServers']) ?? asObject(root['servers']);
      if (!servers) continue;

      for (const [name, def] of Object.entries(servers)) {
        const server = asObject(def);
        if (!server) continue;
        const command = commandString(server['command'], server['args']);
        if (!command) continue; // remote/url servers: no local process
        findings.push(serverFinding(this.id, file, name, command, doc.lineContaining(`"${name}"`)));
      }
    }

    for (const file of pickByName(files, '.codex/config.toml')) {
      const raw = read(file);
      if (raw === null) continue;

      let doc;
      try {
        doc = parseToml(raw);
      } catch (e) {
        unreadable.push({ file, reason: (e as Error).message });
        continue;
      }

      const servers = asObject(doc.value['mcp_servers']);
      if (servers) {
        for (const [name, def] of Object.entries(servers)) {
          const server = asObject(def);
          if (!server) continue;
          const command = commandString(server['command'], server['args']);
          if (!command) continue;
          findings.push(serverFinding(this.id, file, name, command, doc.lineContaining(name)));
        }
      }

      const notify = asArray(doc.value['notify']);
      const notifyCmd = notify && commandString(notify);
      if (notifyCmd) {
        const signals = analyzeCommand(notifyCmd);
        findings.push({
          surface: this.id,
          title: 'Codex notify program runs on agent events',
          trigger: 'agent-session',
          boundary: 'host',
          gate: 'none',
          severity: gradeSeverity('host', 'none', 'agent-session', signals),
          file,
          line: doc.lineContaining('notify'),
          evidence: evidenceOf(notifyCmd),
          signals,
          note: 'Runs on your machine when Codex emits an event.',
        });
      }
    }

    return { findings, unreadable };
  },
};

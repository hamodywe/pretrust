/**
 * The risk overlay.
 *
 * A command string taken from an execution path — a task, a git hook, a
 * lifecycle script — is inert text until something runs it. These detectors ask
 * a narrower, answerable question than "is this malicious": does the command do
 * one of the specific things that droppers do and honest build steps do not?
 *
 * Every signal is a stated textual pattern, documented in the README. None of
 * them is a verdict; they raise a path from the inventory to "read this one".
 * Being wrong in the loud direction — firing on a normal `npm run build` — is
 * the failure mode this file is written to avoid, so the patterns are specific
 * rather than broad.
 */
import type { Signal } from '../model.js';

const NETWORK = /\b(curl|wget|Invoke-WebRequest|iwr|Invoke-RestMethod|irm|Start-BitsTransfer)\b/i;
const NETWORK_NODE = /\b(https?|node-fetch|axios)\b.*\b(get|fetch|request)\b/i;
const INTO_INTERPRETER =
  /\|\s*(sh|bash|zsh|dash|python[0-9.]*|node|deno|bun|perl|ruby|iex|Invoke-Expression|pwsh|powershell)\b/i;
const SHELL_C_SUBSHELL = /\b(sh|bash|zsh|pwsh|powershell)\b[^\n]*-c[^\n]*\$\(/i;

const BASE64 = /\b(base64\s+(-d|--decode)|FromBase64String|atob\s*\(|b64decode)\b/i;
const PS_ENCODED = /\s-(enc|e|encodedcommand)\s+[A-Za-z0-9+/=]{16,}/i;
const EVAL = /\beval\s*\(|\bexec\s*\(|\bFunction\s*\(\s*['"`]/;
const HEX_BLOB = /(\\x[0-9a-fA-F]{2}){8,}/;

const OS_BRANCH =
  /\b(process\.platform|uname|\$OSTYPE|%OS%|\bif\b[^\n]*\b(win32|darwin|linux|windows_nt))\b/i;

// Interpreter-redirect variables only. A plain `PATH=./node_modules/.bin:$PATH`
// is a ubiquitous, legitimate direnv line and is deliberately not matched here —
// flagging it would bury the real signal under noise.
const ENV_HIJACK =
  /\b(BASH_ENV|NODE_OPTIONS|PYTHONSTARTUP|PYTHONPATH|LD_PRELOAD|LD_LIBRARY_PATH|GIT_SSH_COMMAND|PROMPT_COMMAND)\s*=/;

const AUTOSTART_TARGET =
  /(>>?|tee|Add-Content|Set-Content|Out-File)\s+[^\n]*(\.bashrc|\.zshrc|\.profile|\.bash_profile|\.vscode[\\/]|\.git[\\/]hooks|crontab|autostart|LaunchAgents|\.claude[\\/]|\.cursor[\\/])/i;
const CRONTAB = /\bcrontab\s+-/i;

// A hidden *file* passed to an interpreter, e.g. `node .cache.js` or `sh .init`.
// A normal relative path (`node ./server.js`, `node ./.config/x.js`) is not a
// dotfile invocation and is intentionally not matched.
const HIDDEN_EXEC =
  /(^|[\s;&|(])(node|python[0-9.]*|sh|bash|deno|bun|source|\.)\s+\.[\w-]+(\.[\w-]+)*(\s|$|[;&|])/im;

interface Detector {
  readonly kind: Signal['kind'];
  detect(cmd: string): string | null;
}

const DETECTORS: readonly Detector[] = [
  {
    kind: 'fetch-execute',
    detect(cmd) {
      const fetches = NETWORK.test(cmd) || NETWORK_NODE.test(cmd);
      if (!fetches) return null;
      if (INTO_INTERPRETER.test(cmd)) return 'downloads and pipes the response into an interpreter';
      if (SHELL_C_SUBSHELL.test(cmd)) return 'downloads and runs the response through a shell subshell';
      return null;
    },
  },
  {
    kind: 'obfuscated',
    detect(cmd) {
      if (BASE64.test(cmd)) return 'decodes a base64 payload';
      if (PS_ENCODED.test(cmd)) return 'runs a base64-encoded PowerShell command';
      if (HEX_BLOB.test(cmd)) return 'contains a hex-escaped blob';
      if (EVAL.test(cmd)) return 'builds and evaluates code at runtime';
      return null;
    },
  },
  {
    kind: 'env-hijack',
    detect(cmd) {
      return ENV_HIJACK.test(cmd)
        ? 'sets an environment variable that redirects what interpreters load'
        : null;
    },
  },
  {
    kind: 'writes-autostart',
    detect(cmd) {
      if (AUTOSTART_TARGET.test(cmd)) return 'writes into another auto-execution surface';
      if (CRONTAB.test(cmd)) return 'installs a cron entry';
      return null;
    },
  },
  {
    kind: 'hidden-target',
    detect(cmd) {
      return HIDDEN_EXEC.test(cmd) ? 'invokes a dotfile as an executable' : null;
    },
  },
  {
    kind: 'os-branch',
    detect(cmd) {
      return OS_BRANCH.test(cmd) ? 'branches behaviour by operating system' : null;
    },
  },
];

/**
 * Inspect a command string and return the signals it raises. `os-branch` is
 * deliberately weak on its own — a build script legitimately branches by OS — so
 * it is emitted but weighted lightly by the severity logic that consumes it.
 */
export function analyzeCommand(command: string): Signal[] {
  if (!command) return [];
  const signals: Signal[] = [];
  for (const d of DETECTORS) {
    const detail = d.detect(command);
    if (detail) signals.push({ kind: d.kind, detail });
  }
  return signals;
}

/** Signals that, on their own, justify elevating a path to high severity. */
const STRONG: ReadonlySet<Signal['kind']> = new Set([
  'fetch-execute',
  'obfuscated',
  'env-hijack',
  'writes-autostart',
  'auto-approve',
]);

export function hasStrongSignal(signals: readonly Signal[]): boolean {
  return signals.some((s) => STRONG.has(s.kind));
}

/**
 * A `host-escape` is notable rather than damning: a dev container legitimately
 * runs an `initializeCommand` on the host. It lifts a path out of the inventory
 * without, on its own, calling it high severity.
 */
export function hasNotableSignal(signals: readonly Signal[]): boolean {
  return signals.some((s) => s.kind === 'host-escape');
}

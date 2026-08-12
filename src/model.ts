/**
 * The vocabulary pretrust speaks in.
 *
 * The central claim of this tool is that a code-execution path is a *fact* about
 * a repository, not a guess about intent. Every finding therefore records three
 * provable things — WHAT executes, WHEN it fires, and WHERE control lands — and
 * separately an optional risk overlay of *why* a given path looks worth a second
 * look. The map is always correct; the overlay is where judgement lives.
 */

/** When a path executes, relative to a developer obtaining the repository. */
export type Trigger =
  | 'folder-open' // the editor runs it as the workspace opens
  | 'agent-session' // an AI coding agent runs it when a session starts
  | 'container-init' // a dev container runs it while building/starting
  | 'directory-enter' // a shell hook runs it on `cd` into the directory
  | 'install' // a package manager runs it during dependency install
  | 'git-op' // a git hook or fsmonitor runs it during a git operation
  | 'interpreter-start'; // a language runtime runs it when the interpreter loads

/** Where the process ultimately runs — the trust boundary control crosses. */
export type Boundary =
  | 'host' // the developer's machine, unsandboxed
  | 'container' // inside a dev container, isolated from the host
  | 'agent'; // the coding agent's tool loop, which can usually reach the host anyway

/**
 * What stands between cloning the repo and the code running. Reported honestly:
 * some paths need a click, but the whole point of this tool is that the click is
 * routine and the consequence is not.
 */
export type Gate =
  | 'none' // runs with no further consent once the repo is present
  | 'workspace-trust' // one "trust the authors" click, then it runs on every open
  | 'shell-allow' // one `direnv allow`, then it runs on every `cd`
  | 'install-step' // runs when the developer installs dependencies
  | 'git-action'; // runs when the developer performs a routine git action

export type Severity = 'high' | 'medium' | 'low' | 'info';

/** A provably-suspicious trait found *inside* an execution path's command. */
export interface Signal {
  readonly kind:
    | 'fetch-execute' // downloads and pipes straight into an interpreter
    | 'obfuscated' // base64 / eval(atob(...)) / hex-escaped payload
    | 'os-branch' // forks behaviour by platform, a hallmark of droppers
    | 'env-hijack' // rewrites PATH / BASH_ENV / NODE_OPTIONS to load repo files
    | 'host-escape' // runs on the host from an otherwise-sandboxed surface
    | 'auto-approve' // disables the human confirmation an agent would ask for
    | 'writes-autostart' // writes into another auto-execution surface
    | 'hidden-target'; // invokes a dotfile / unusual path as an executable
  readonly detail: string;
}

/** One execution path, located and classified. */
export interface Finding {
  /** Stable identifier for the surface, e.g. `vscode-tasks`. */
  readonly surface: string;
  /** Human title, e.g. `VS Code task runs on folder open`. */
  readonly title: string;
  readonly trigger: Trigger;
  readonly boundary: Boundary;
  readonly gate: Gate;
  readonly severity: Severity;
  /** Repo-relative path of the file the finding lives in. */
  readonly file: string;
  /** 1-indexed line the finding anchors to, or 0 when not line-addressable. */
  readonly line: number;
  /** The command or configuration value that proves the path exists. */
  readonly evidence: string;
  /** Risk overlay — empty for an inventory-only entry. */
  readonly signals: readonly Signal[];
  /** One sentence a reader can act on. */
  readonly note: string;
}

/** The full result of scanning one repository. */
export interface ScanResult {
  readonly root: string;
  readonly findings: readonly Finding[];
  /** Files that matched a surface but could not be parsed, for transparency. */
  readonly unreadable: readonly { readonly file: string; readonly reason: string }[];
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
  info: 3,
};

/** A scanner for one execution surface. Pure: files in, findings out. */
export interface Surface {
  readonly id: string;
  /**
   * @param files  repo-relative paths present in the scan, forward-slashed
   * @param read   reads a repo-relative file, or null if absent/too large
   */
  scan(
    files: readonly string[],
    read: (file: string) => string | null,
  ): { findings: Finding[]; unreadable: { file: string; reason: string }[] };
}

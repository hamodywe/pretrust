/**
 * The `pretrust` command. A thin, testable wrapper: `parseArgs` turns argv into
 * an intent, `run` executes it against injected streams so the whole thing can
 * be driven in-process by tests and as a real binary in production.
 */
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SEVERITY_ORDER, type Finding, type ScanResult, type Severity } from './model.js';
import { scanRepo, scanFiles, diffFindings } from './scan/scan.js';
import { gitRepoScan } from './git/tree.js';
import { applyBaseline, loadBaseline, writeBaseline, DEFAULT_BASELINE_PATH } from './baseline.js';
import { renderTerminal } from './report/terminal.js';
import { renderJson } from './report/json.js';
import { renderSarif } from './report/sarif.js';
import { renderExplain, SURFACE_DOCS } from './explain.js';
import { createStyle } from './report/style.js';
import { VERSION } from './version.js';

export type Format = 'terminal' | 'json' | 'sarif';

export interface CliOptions {
  path: string;
  format: Format;
  min: Severity;
  failOn: Severity | 'none';
  color: boolean | undefined;
  diff: string | undefined;
  baseline: string | undefined;
  updateBaseline: boolean;
}

export type ParseResult =
  | { kind: 'run'; options: CliOptions }
  | { kind: 'explain'; surface: string | undefined }
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'error'; message: string };

const SEVERITIES: readonly Severity[] = ['high', 'medium', 'low', 'info'];

function isSeverity(v: string): v is Severity {
  return (SEVERITIES as readonly string[]).includes(v);
}

export function parseArgs(argv: readonly string[]): ParseResult {
  if (argv[0] === 'explain') {
    const next = argv[1];
    return { kind: 'explain', surface: next && !next.startsWith('-') ? next : undefined };
  }

  const options: CliOptions = {
    path: '.',
    format: 'terminal',
    min: 'info',
    failOn: 'high',
    color: undefined,
    diff: undefined,
    baseline: undefined,
    updateBaseline: false,
  };
  let pathSet = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case '-h':
      case '--help':
        return { kind: 'help' };
      case '-v':
      case '--version':
        return { kind: 'version' };
      case '--json':
        options.format = 'json';
        break;
      case '--sarif':
        options.format = 'sarif';
        break;
      case '--color':
        options.color = true;
        break;
      case '--no-color':
        options.color = false;
        break;
      case '--update-baseline':
        options.updateBaseline = true;
        break;
      case '--min': {
        const v = argv[++i];
        if (v === undefined || !isSeverity(v)) {
          return { kind: 'error', message: `--min expects one of ${SEVERITIES.join(', ')}` };
        }
        options.min = v;
        break;
      }
      case '--fail-on': {
        const v = argv[++i];
        if (v === undefined || (v !== 'none' && !isSeverity(v))) {
          return { kind: 'error', message: `--fail-on expects one of ${SEVERITIES.join(', ')}, none` };
        }
        options.failOn = v;
        break;
      }
      case '--diff': {
        const v = argv[++i];
        if (v === undefined || v.startsWith('-')) {
          return { kind: 'error', message: '--diff expects a git ref (branch, tag, or commit)' };
        }
        options.diff = v;
        break;
      }
      case '--baseline': {
        const v = argv[++i];
        if (v === undefined || v.startsWith('-')) {
          return { kind: 'error', message: '--baseline expects a file path' };
        }
        options.baseline = v;
        break;
      }
      default:
        if (arg.startsWith('-')) {
          return { kind: 'error', message: `unknown option: ${arg}` };
        }
        if (pathSet) {
          return { kind: 'error', message: `unexpected extra argument: ${arg}` };
        }
        options.path = arg;
        pathSet = true;
    }
  }

  return { kind: 'run', options };
}

const HELP = `pretrust ${VERSION}
Map every code-execution path that fires when you open or clone a repository,
before you run anything.

USAGE
  pretrust [path] [options]
  pretrust explain [surface]

ARGUMENTS
  path                 Directory to scan (default: current directory)

OPTIONS
  --diff <ref>         Report only paths a change ADDS versus a git ref
  --baseline <file>    Suppress paths recorded in a baseline file; fail on new ones
  --update-baseline    Write the current paths to the baseline and exit
  --json               Emit a JSON report
  --sarif              Emit SARIF 2.1.0 for GitHub code scanning
  --min <severity>     Report only findings at or above this level
                       (high | medium | low | info; default: info)
  --fail-on <severity> Exit non-zero if any finding is at or above this level
                       (high | medium | low | info | none; default: high)
  --color / --no-color Force colour on or off (default: auto)
  -v, --version        Print version
  -h, --help           Print this help

SUBCOMMANDS
  explain [surface]    Describe what each surface is, when it fires, and why

EXIT CODES
  0  no findings at or above --fail-on
  1  findings at or above --fail-on
  2  usage or runtime error

Every finding is a fact about the repository: what runs, when it fires, and
where control lands. A "!" line is a risk signal that lifts a path out of the
plain inventory.`;

function atOrAbove(severity: Severity, threshold: Severity): boolean {
  return SEVERITY_ORDER[severity] <= SEVERITY_ORDER[threshold];
}

function withFindings(result: ScanResult, findings: readonly Finding[]): ScanResult {
  return { ...result, findings };
}

function filterMin(result: ScanResult, min: Severity): ScanResult {
  return withFindings(result, result.findings.filter((f) => atOrAbove(f.severity, min)));
}

export interface Streams {
  out: (s: string) => void;
  err: (s: string) => void;
  isTty: boolean;
  env: NodeJS.ProcessEnv;
}

export function run(argv: readonly string[], streams: Streams): number {
  const parsed = parseArgs(argv);

  const style = () =>
    createStyle({
      isTty: streams.isTty,
      env: streams.env,
    });

  if (parsed.kind === 'help') {
    streams.out(HELP);
    return 0;
  }
  if (parsed.kind === 'version') {
    streams.out(VERSION);
    return 0;
  }
  if (parsed.kind === 'explain') {
    streams.out(renderExplain(parsed.surface, style()));
    const unknown =
      parsed.surface !== undefined && !SURFACE_DOCS.some((d) => d.id === parsed.surface);
    return unknown ? 2 : 0;
  }
  if (parsed.kind === 'error') {
    streams.err(`pretrust: ${parsed.message}`);
    streams.err('Run `pretrust --help` for usage.');
    return 2;
  }

  const { options } = parsed;

  let result: ScanResult;
  try {
    result = scanRepo(options.path);
  } catch (e) {
    streams.err(`pretrust: could not scan ${options.path}: ${(e as Error).message}`);
    return 2;
  }

  // --update-baseline: record the current full inventory and exit.
  if (options.updateBaseline) {
    const path = options.baseline ?? DEFAULT_BASELINE_PATH;
    try {
      const count = writeBaseline(path, result.findings);
      streams.out(`pretrust: wrote ${count} accepted path(s) to ${path}`);
      return 0;
    } catch (e) {
      streams.err(`pretrust: could not write baseline ${path}: ${(e as Error).message}`);
      return 2;
    }
  }

  // Start from the full inventory; each reducer narrows what the gate considers.
  let gated = result.findings;
  const notes: string[] = [];

  if (options.diff !== undefined) {
    try {
      const base = scanFiles(options.path, gitRepoScan(options.path, options.diff));
      gated = diffFindings(base.findings, gated);
      notes.push(`showing paths added versus ${options.diff}`);
    } catch (e) {
      streams.err(`pretrust: ${(e as Error).message}`);
      return 2;
    }
  }

  if (options.baseline !== undefined) {
    const baseline = loadBaseline(options.baseline);
    if (baseline === null) {
      streams.err(
        `pretrust: baseline ${options.baseline} not found — treating every path as new. ` +
          `Create it with \`pretrust ${options.path} --update-baseline --baseline ${options.baseline}\`.`,
      );
    } else {
      const { fresh, suppressed } = applyBaseline(gated, baseline);
      gated = fresh;
      notes.push(`${suppressed.length} path(s) suppressed by baseline`);
    }
  }

  const gatedResult = withFindings(result, gated);
  const shown = filterMin(gatedResult, options.min);

  if (options.format === 'json') {
    streams.out(renderJson(shown, VERSION));
  } else if (options.format === 'sarif') {
    streams.out(renderSarif(shown, VERSION));
  } else {
    const s = createStyle({
      isTty: options.color ?? streams.isTty,
      env: options.color === false ? { ...streams.env, NO_COLOR: '1' } : streams.env,
    });
    streams.out(renderTerminal(shown, s));
    if (notes.length) streams.out(s.dim(`  (${notes.join('; ')})\n`));
  }

  if (options.failOn === 'none') return 0;
  const failing = gated.some((f) => atOrAbove(f.severity, options.failOn as Severity));
  return failing ? 1 : 0;
}

/** True when this module is the process entry point, resilient to bin symlinks. */
function isEntry(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  let resolved = argv1;
  try {
    resolved = realpathSync(argv1);
  } catch {
    /* fall back to the raw path */
  }
  return import.meta.url === pathToFileURL(resolved).href;
}

if (isEntry()) {
  const code = run(process.argv.slice(2), {
    out: (s) => process.stdout.write(s + '\n'),
    err: (s) => process.stderr.write(s + '\n'),
    isTty: process.stdout.isTTY ?? false,
    env: process.env,
  });
  process.exitCode = code;
}

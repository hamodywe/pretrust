/**
 * pretrust — map every code-execution path that fires when you open or clone a
 * repository, before you run anything.
 *
 * Programmatic entry point. The CLI in `cli.ts` is a thin wrapper over these.
 */
export { scanRepo, scanFiles, SURFACES } from './scan/scan.js';
export { collectRepo, type RepoScan } from './scan/fs.js';
export { renderTerminal } from './report/terminal.js';
export { renderJson, type JsonReport } from './report/json.js';
export { renderSarif } from './report/sarif.js';
export { createStyle, type Style } from './report/style.js';
export { analyzeCommand } from './signals/command.js';
export { gradeSeverity } from './severity.js';
export { VERSION } from './version.js';
export type {
  Finding,
  ScanResult,
  Severity,
  Signal,
  Surface,
  Trigger,
  Boundary,
  Gate,
} from './model.js';

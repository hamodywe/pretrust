/**
 * pretrust — map every code-execution path that fires when you open or clone a
 * repository, before you run anything.
 *
 * Programmatic entry point. The CLI in `cli.ts` is a thin wrapper over these.
 */
export { scanRepo, scanFiles, diffFindings, SURFACES } from './scan/scan.js';
export { collectRepo, type RepoScan } from './scan/fs.js';
export { gitRepoScan, isGitRepo } from './git/tree.js';
export { loadBaseline, writeBaseline, applyBaseline, DEFAULT_BASELINE_PATH } from './baseline.js';
export { renderExplain, SURFACE_DOCS, type SurfaceDoc } from './explain.js';
export { renderTerminal } from './report/terminal.js';
export { renderJson, type JsonReport } from './report/json.js';
export { renderSarif } from './report/sarif.js';
export { createStyle, type Style } from './report/style.js';
export { analyzeCommand } from './signals/command.js';
export { gradeSeverity } from './severity.js';
export { VERSION } from './version.js';
export {
  findingKey,
  type Finding,
  type ScanResult,
  type Severity,
  type Signal,
  type Surface,
  type Trigger,
  type Boundary,
  type Gate,
} from './model.js';

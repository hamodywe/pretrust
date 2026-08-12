/**
 * The orchestrator: run every surface over one repository and return a stable,
 * sorted result. Order is deterministic — severity, then file, then line — so
 * two runs over the same tree produce byte-identical output, which is what makes
 * the tool usable as a CI gate.
 */
import { SEVERITY_ORDER, type Finding, type ScanResult, type Surface } from '../model.js';
import { collectRepo, type RepoScan } from './fs.js';
import { agentHooks } from '../surfaces/agentHooks.js';
import { devcontainer } from '../surfaces/devcontainer.js';
import { direnv } from '../surfaces/direnv.js';
import { gitConfig } from '../surfaces/gitConfig.js';
import { gitHooks } from '../surfaces/gitHooks.js';
import { mcp } from '../surfaces/mcp.js';
import { npmLifecycle } from '../surfaces/npmLifecycle.js';
import { vscodeSettings } from '../surfaces/vscodeSettings.js';
import { vscodeTasks } from '../surfaces/vscodeTasks.js';

export const SURFACES: readonly Surface[] = [
  vscodeTasks,
  vscodeSettings,
  devcontainer,
  npmLifecycle,
  gitHooks,
  gitConfig,
  direnv,
  agentHooks,
  mcp,
];

function compareFindings(a: Finding, b: Finding): number {
  const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  if (bySeverity !== 0) return bySeverity;
  const byFile = a.file.localeCompare(b.file);
  if (byFile !== 0) return byFile;
  if (a.line !== b.line) return a.line - b.line;
  return a.surface.localeCompare(b.surface);
}

/** Scan a repository given a pre-collected file set (used by tests). */
export function scanFiles(root: string, repo: RepoScan): ScanResult {
  const findings: Finding[] = [];
  const unreadable: { file: string; reason: string }[] = [];

  for (const surface of SURFACES) {
    const result = surface.scan(repo.files, repo.read);
    findings.push(...result.findings);
    unreadable.push(...result.unreadable);
  }

  findings.sort(compareFindings);
  unreadable.sort((a, b) => a.file.localeCompare(b.file));
  return { root, findings, unreadable };
}

/** Scan a repository on disk. */
export function scanRepo(root: string): ScanResult {
  return scanFiles(root, collectRepo(root));
}

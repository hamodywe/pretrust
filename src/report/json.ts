/**
 * Machine-readable output. A stable, documented shape so the tool can feed a
 * dashboard, a policy check, or another program without screen-scraping the
 * terminal report.
 */
import type { ScanResult, Severity } from '../model.js';

export interface JsonReport {
  readonly tool: 'pretrust';
  readonly version: string;
  readonly root: string;
  readonly summary: Record<Severity, number> & { total: number };
  readonly findings: ScanResult['findings'];
  readonly unreadable: ScanResult['unreadable'];
}

export function renderJson(result: ScanResult, version: string): string {
  const summary: Record<Severity, number> & { total: number } = {
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: result.findings.length,
  };
  for (const f of result.findings) summary[f.severity]++;

  const report: JsonReport = {
    tool: 'pretrust',
    version,
    root: result.root,
    summary,
    findings: result.findings,
    unreadable: result.unreadable,
  };
  return JSON.stringify(report, null, 2);
}

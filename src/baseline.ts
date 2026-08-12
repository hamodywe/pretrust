/**
 * Baseline support — the lint-baseline idea applied to execution paths. A team
 * that adopts pretrust on an existing repository records the paths it has already
 * reviewed and accepted; from then on the gate fails only on paths that are *new*
 * relative to that record, so pre-existing inventory does not block every build.
 *
 * The file stores stable finding keys (line-independent), sorted for a clean
 * diff, with no timestamp so the same findings always produce the same file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { findingKey, type Finding } from './model.js';

interface BaselineFile {
  readonly tool: 'pretrust';
  readonly note: string;
  readonly keys: string[];
}

const NOTE =
  'Accepted execution paths. Regenerate with `pretrust <path> --update-baseline`. Do not edit by hand.';

/** Read a baseline file into a key set, or null if it does not exist. */
export function loadBaseline(path: string): Set<string> | null {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  const parsed = JSON.parse(raw) as Partial<BaselineFile>;
  const keys = Array.isArray(parsed.keys) ? parsed.keys.filter((k) => typeof k === 'string') : [];
  return new Set(keys);
}

/** Write the current findings' keys as the new baseline. Returns the count. */
export function writeBaseline(path: string, findings: readonly Finding[]): number {
  const keys = [...new Set(findings.map(findingKey))].sort();
  const file: BaselineFile = { tool: 'pretrust', note: NOTE, keys };
  writeFileSync(path, JSON.stringify(file, null, 2) + '\n');
  return keys.length;
}

/** Partition findings into those new relative to the baseline and those matched. */
export function applyBaseline(
  findings: readonly Finding[],
  baseline: Set<string>,
): { fresh: Finding[]; suppressed: Finding[] } {
  const fresh: Finding[] = [];
  const suppressed: Finding[] = [];
  for (const f of findings) {
    if (baseline.has(findingKey(f))) suppressed.push(f);
    else fresh.push(f);
  }
  return { fresh, suppressed };
}

export const DEFAULT_BASELINE_PATH = '.pretrust-baseline.json';

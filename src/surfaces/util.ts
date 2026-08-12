/** Small shared helpers for surface scanners. */
import { asArray } from '../parse/json.js';

/**
 * Reduce a VS Code / config command value to a single string for analysis.
 * A command may be a bare string, or a `command` plus an `args` array, or a
 * list used as an argv. Joining with spaces is lossy for the shell but exact
 * enough for the textual signal detectors, which look for tokens not structure.
 */
export function commandString(command: unknown, args?: unknown): string | null {
  const parts: string[] = [];

  if (typeof command === 'string') parts.push(command);
  else {
    const arr = asArray(command);
    if (arr) parts.push(...arr.filter((x): x is string => typeof x === 'string'));
  }

  const argArr = asArray(args);
  if (argArr) {
    for (const a of argArr) {
      if (typeof a === 'string') parts.push(a);
      else if (a && typeof a === 'object' && typeof (a as { value?: unknown }).value === 'string') {
        parts.push((a as { value: string }).value);
      }
    }
  }

  const joined = parts.join(' ').trim();
  return joined.length ? joined : null;
}

/** Files whose path exactly equals one of `paths`. */
export function pickExact(files: readonly string[], paths: readonly string[]): string[] {
  const set = new Set(paths);
  return files.filter((f) => set.has(f));
}

/** Files directly inside `dir` (one level), e.g. `.husky/pre-commit`. */
export function pickChildren(files: readonly string[], dir: string): string[] {
  const prefix = dir.endsWith('/') ? dir : dir + '/';
  return files.filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes('/'));
}

/** Files anywhere under `dir`. */
export function pickUnder(files: readonly string[], dir: string): string[] {
  const prefix = dir.endsWith('/') ? dir : dir + '/';
  return files.filter((f) => f.startsWith(prefix));
}

/** Files whose basename equals `name`. */
export function pickByName(files: readonly string[], name: string): string[] {
  return files.filter((f) => f === name || f.endsWith('/' + name));
}

/** A short, single-line rendering of a command for evidence display. */
export function evidenceOf(command: string, max = 200): string {
  const oneLine = command.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? oneLine.slice(0, max - 1) + '…' : oneLine;
}

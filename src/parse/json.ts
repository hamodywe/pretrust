/**
 * A tolerant JSONC reader for the editor and agent config files that ship with
 * repositories. `.vscode/tasks.json`, `.vscode/settings.json`, `.mcp.json` and
 * their kin all permit line and block comments and trailing commas, which
 * `JSON.parse` rejects outright.
 *
 * Comments and trailing commas are blanked in place — replaced by spaces of the
 * same length, newlines preserved — so byte offsets and line numbers survive the
 * normalisation. That lets us parse the value with the platform `JSON.parse`
 * while still anchoring findings to the exact line a reader will look at.
 *
 * Quote state is tracked character by character. A `//` inside a JSON string is
 * a URL, not a comment; a `,` inside a string is data, not a trailing comma.
 * Getting that wrong is how a scanner silently mangles the file it is judging.
 */

export interface ParsedJsonc {
  readonly value: unknown;
  /** 1-indexed line of a character offset in the original text. */
  lineOf(offset: number): number;
  /** First offset of `needle` at or after `from`, or -1. Skips string interiors is *not* done here — callers search for quoted keys. */
  indexOf(needle: string, from?: number): number;
  /** Convenience: 1-indexed line of the first occurrence of `needle`, or 0. */
  lineContaining(needle: string, from?: number): number;
}

/** Replace comments and trailing commas with spaces, preserving every newline. */
function blank(raw: string): string {
  const out = raw.split('');
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }

    if (c === '"') {
      inString = true;
      continue;
    }

    if (c === '/' && raw[i + 1] === '/') {
      while (i < raw.length && raw[i] !== '\n') {
        out[i] = ' ';
        i++;
      }
      i--; // the loop's i++ will step over the newline
      continue;
    }

    if (c === '/' && raw[i + 1] === '*') {
      out[i] = ' ';
      out[i + 1] = ' ';
      i += 2;
      while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) {
        if (raw[i] !== '\n') out[i] = ' ';
        i++;
      }
      if (i < raw.length) {
        out[i] = ' ';
        out[i + 1] = ' ';
        i++;
      }
      continue;
    }
  }

  return out.join('');
}

/** Blank any comma that is followed only by whitespace before a `}` or `]`. */
function blankTrailingCommas(blanked: string): string {
  const out = blanked.split('');
  let inString = false;
  let escaped = false;

  for (let i = 0; i < blanked.length; i++) {
    const c = blanked[i]!;

    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }

    if (c === '"') {
      inString = true;
      continue;
    }

    if (c === ',') {
      let j = i + 1;
      while (j < blanked.length && /\s/.test(blanked[j]!)) j++;
      if (blanked[j] === '}' || blanked[j] === ']') out[i] = ' ';
    }
  }

  return out.join('');
}

function buildLineTable(raw: string): number[] {
  // starts[n] = offset at which 1-indexed line (n+1) begins
  const starts = [0];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

/**
 * Parse JSONC text. Throws a plain `Error` with the underlying `JSON.parse`
 * message when the value is malformed — callers surface that as `unreadable`
 * rather than crashing the scan.
 */
export function parseJsonc(raw: string): ParsedJsonc {
  const normalised = blankTrailingCommas(blank(raw));
  const value = JSON.parse(normalised) as unknown;
  const starts = buildLineTable(raw);

  const lineOf = (offset: number): number => {
    if (offset < 0) return 0;
    // binary search for the greatest start <= offset
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  const indexOf = (needle: string, from = 0): number => raw.indexOf(needle, from);

  const lineContaining = (needle: string, from = 0): number => {
    const idx = raw.indexOf(needle, from);
    return idx === -1 ? 0 : lineOf(idx);
  };

  return { value, lineOf, indexOf, lineContaining };
}

/** Narrow an unknown parsed value to a plain object, or null. */
export function asObject(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Narrow an unknown parsed value to an array, or null. */
export function asArray(v: unknown): unknown[] | null {
  return Array.isArray(v) ? (v as unknown[]) : null;
}

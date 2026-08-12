/**
 * A deliberately small TOML reader for `.codex/config.toml`. It covers exactly
 * what this tool needs to read from it — tables and dotted table headers,
 * array-of-tables headers, quoted and bare keys, string / boolean / number
 * scalars, and single-line arrays of strings — and nothing more. Anything it
 * does not understand is preserved as a raw string rather than guessed at, so a
 * value it cannot model never masquerades as one it can.
 *
 * This is not a general TOML implementation and does not claim to be; multi-line
 * arrays and inline-table nesting beyond one level are out of scope and
 * documented as such.
 */

export interface ParsedToml {
  readonly value: Record<string, unknown>;
  lineOf(offset: number): number;
  lineContaining(needle: string, from?: number): number;
}

type Obj = Record<string, unknown>;

function unquote(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    return t.slice(1, -1);
  }
  return t;
}

/** Split an inline `[...]` body on top-level commas, respecting quotes. */
function splitArray(body: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quote) {
      if (c === quote) quote = null;
      cur += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      cur += c;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

function parseValue(raw: string): unknown {
  const t = raw.trim();
  if (t.startsWith('[') && t.endsWith(']')) {
    return splitArray(t.slice(1, -1)).map((x) => parseValue(x));
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^[+-]?\d+$/.test(t)) return Number(t);
  return unquote(t);
}

function splitDotted(header: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < header.length; i++) {
    const c = header[i]!;
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '.') {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  parts.push(cur.trim());
  return parts.map((p) => unquote(p));
}

function descend(root: Obj, path: string[], arrayTable: boolean): Obj {
  let cur = root;
  for (let i = 0; i < path.length; i++) {
    const key = path[i]!;
    const last = i === path.length - 1;
    if (last && arrayTable) {
      const existing = cur[key];
      const arr = Array.isArray(existing) ? (existing as Obj[]) : [];
      const next: Obj = {};
      arr.push(next);
      cur[key] = arr;
      return next;
    }
    let next = cur[key];
    if (next === undefined || typeof next !== 'object' || Array.isArray(next)) {
      next = {};
      cur[key] = next;
    }
    cur = next as Obj;
  }
  return cur;
}

export function parseToml(raw: string): ParsedToml {
  const root: Obj = {};
  let current = root;

  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmed = line.replace(/\s+#.*$/, '').trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const arrTable = trimmed.match(/^\[\[(.+)\]\]$/);
    if (arrTable) {
      current = descend(root, splitDotted(arrTable[1]!), true);
      continue;
    }
    const table = trimmed.match(/^\[(.+)\]$/);
    if (table) {
      current = descend(root, splitDotted(table[1]!), false);
      continue;
    }

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const keyPart = trimmed.slice(0, eq).trim();
    const valuePart = trimmed.slice(eq + 1).trim();
    const keyPath = splitDotted(keyPart);
    const target = keyPath.length > 1 ? descend(current, keyPath.slice(0, -1), false) : current;
    target[keyPath[keyPath.length - 1]!] = parseValue(valuePart);
  }

  const starts = [0];
  for (let i = 0; i < raw.length; i++) if (raw[i] === '\n') starts.push(i + 1);

  const lineOf = (offset: number): number => {
    if (offset < 0) return 0;
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const lineContaining = (needle: string, from = 0): number => {
    const idx = raw.indexOf(needle, from);
    return idx === -1 ? 0 : lineOf(idx);
  };

  return { value: root, lineOf, lineContaining };
}

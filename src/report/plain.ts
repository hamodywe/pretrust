/**
 * Every string this tool prints for a finding — evidence, notes, file paths —
 * originates in a repository it does not trust. A crafted config could embed
 * escape sequences that move the cursor, recolour the terminal, or hide text.
 * Control characters are stripped before display so a scanned file can never
 * rewrite the report about it. Tabs and newlines are collapsed to spaces so a
 * finding stays on its own line.
 */
export function plain(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      out += ' ';
    } else if (code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f)) {
      // C0 and C1 control ranges, including ESC (0x1b) — drop entirely.
      continue;
    } else {
      out += ch;
    }
  }
  return out;
}

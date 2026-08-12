/**
 * ANSI styling that disables itself when colour is unwanted: when `NO_COLOR` is
 * set (any value), when `FORCE_COLOR` is `0`, or when the stream is not a TTY.
 * `FORCE_COLOR` with a non-zero value wins, for CI logs that render colour.
 */
export interface Style {
  readonly enabled: boolean;
  bold(s: string): string;
  dim(s: string): string;
  red(s: string): string;
  yellow(s: string): string;
  blue(s: string): string;
  green(s: string): string;
  cyan(s: string): string;
}

function wrap(code: number, s: string): string {
  return `[${code}m${s}[0m`;
}

export function createStyle(opts: { isTty: boolean; env: NodeJS.ProcessEnv }): Style {
  const { isTty, env } = opts;
  const force = env['FORCE_COLOR'];
  const enabled =
    force !== undefined && force !== ''
      ? force !== '0'
      : env['NO_COLOR'] === undefined && isTty;

  const paint = (code: number) => (s: string) => (enabled ? wrap(code, s) : s);

  return {
    enabled,
    bold: paint(1),
    dim: paint(2),
    red: paint(31),
    yellow: paint(33),
    blue: paint(34),
    green: paint(32),
    cyan: paint(36),
  };
}

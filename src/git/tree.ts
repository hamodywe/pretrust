/**
 * A `RepoScan` backed by a git ref instead of the working tree, so the same
 * surface scanners can be run over how the repository looked at some base commit.
 *
 * This uses git plumbing — `ls-tree` to list the ref's files and `show` to read
 * them — which is read-only and never executes anything from the repository. It
 * is the one place the tool shells out, and only for `--diff`.
 */
import { execFileSync } from 'node:child_process';
import type { RepoScan } from '../scan/fs.js';

const MAX_BYTES = 1_000_000;

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/** True if `root` is inside a git work tree. */
export function isGitRepo(root: string): boolean {
  try {
    return git(root, ['rev-parse', '--is-inside-work-tree']).trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Build a scan view of the repository as it existed at `ref`. Throws a plain
 * Error with an actionable message when the directory is not a git repo or the
 * ref cannot be resolved.
 */
export function gitRepoScan(root: string, ref: string): RepoScan {
  if (!isGitRepo(root)) {
    throw new Error(`${root} is not a git repository, so --diff has no base to compare against`);
  }
  try {
    git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  } catch {
    throw new Error(`cannot resolve git ref "${ref}" — check the branch or commit exists`);
  }

  // `root` may be a subdirectory of the repository. Scope the listing to it and
  // strip the prefix, so the paths line up with a working-tree scan of the same
  // directory — otherwise every path reads as "added" in a --diff.
  let prefix = '';
  try {
    prefix = git(root, ['rev-parse', '--show-prefix']).trim(); // '' at repo root, else 'sub/dir/'
  } catch {
    prefix = '';
  }

  let listing: string;
  try {
    listing = git(root, ['ls-tree', '-r', '-z', '--name-only', ref, '--', '.']);
  } catch (e) {
    throw new Error(`could not list files at "${ref}": ${(e as Error).message}`);
  }
  const files = listing
    .split('\0')
    .filter((f) => f.length > 0)
    .map((f) => (prefix && f.startsWith(prefix) ? f.slice(prefix.length) : f))
    .sort();

  const cache = new Map<string, string | null>();
  const read = (file: string): string | null => {
    if (cache.has(file)) return cache.get(file)!;
    let content: string | null = null;
    try {
      const out = git(root, ['show', `${ref}:${prefix}${file}`]);
      content = out.length <= MAX_BYTES ? out : null;
    } catch {
      content = null; // path absent at ref, or unreadable
    }
    cache.set(file, content);
    return content;
  };

  return { files, read };
}

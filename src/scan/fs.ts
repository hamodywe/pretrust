/**
 * Repository walk. Collects forward-slashed, repo-relative file paths and hands
 * back a bounded reader. Symlinks are never followed — a symlinked directory
 * could loop or point outside the repository, and a scanner that can be walked
 * out of its own root is a scanner that can be lied to.
 *
 * `.git` is normally skipped, with two deliberate exceptions: `.git/config` and
 * the contents of `.git/hooks`. Those are exactly the parts of `.git` that a
 * repository delivered as an archive can weaponise, and the only parts the git
 * surfaces need to read.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.hg', '.svn', '.pijul', '.jj']);
const MAX_BYTES = 1_000_000;

export interface RepoScan {
  readonly files: string[];
  /** Read a repo-relative file, or null if absent, unreadable, or too large. */
  read(file: string): string | null;
}

function listGitAllowlist(gitAbs: string, gitRel: string, files: string[]): void {
  try {
    const cfg = statSync(join(gitAbs, 'config'));
    if (cfg.isFile()) files.push(`${gitRel}/config`);
  } catch {
    /* no config */
  }
  try {
    for (const entry of readdirSync(join(gitAbs, 'hooks'), { withFileTypes: true })) {
      if (entry.isFile()) files.push(`${gitRel}/hooks/${entry.name}`);
    }
  } catch {
    /* no hooks dir */
  }
}

export function collectRepo(root: string): RepoScan {
  const files: string[] = [];

  const walk = (absDir: string, relDir: string): void => {
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (entry.name === '.git') {
          listGitAllowlist(join(absDir, entry.name), rel, files);
          continue;
        }
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(join(absDir, entry.name), rel);
      } else if (entry.isFile()) {
        files.push(rel);
      }
    }
  };

  walk(root, '');
  files.sort();

  const cache = new Map<string, string | null>();
  const read = (file: string): string | null => {
    if (cache.has(file)) return cache.get(file)!;
    let content: string | null = null;
    // Reject traversal outside the root; paths are repo-relative by contract.
    if (!file.includes('..')) {
      try {
        const abs = join(root, ...file.split('/'));
        const st = statSync(abs);
        if (st.isFile() && st.size <= MAX_BYTES) content = readFileSync(abs, 'utf8');
      } catch {
        content = null;
      }
    }
    cache.set(file, content);
    return content;
  };

  return { files, read };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectRepo } from '../dist/scan/fs.js';

function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'pretrust-'));
}

test('collectRepo excludes node_modules but includes source', () => {
  const root = scratch();
  try {
    mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'pkg', 'index.js'), 'x');
    writeFileSync(join(root, 'package.json'), '{}');
    const { files } = collectRepo(root);
    assert.ok(files.includes('package.json'));
    assert.ok(!files.some((f) => f.startsWith('node_modules/')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('collectRepo surfaces only .git/config and .git/hooks from .git', () => {
  const root = scratch();
  try {
    mkdirSync(join(root, '.git', 'hooks'), { recursive: true });
    mkdirSync(join(root, '.git', 'objects'), { recursive: true });
    writeFileSync(join(root, '.git', 'config'), '[core]\n');
    writeFileSync(join(root, '.git', 'hooks', 'post-checkout'), '#!/bin/sh\n');
    writeFileSync(join(root, '.git', 'objects', 'blob'), 'binary');
    writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/main');
    const { files } = collectRepo(root);
    assert.ok(files.includes('.git/config'));
    assert.ok(files.includes('.git/hooks/post-checkout'));
    assert.ok(!files.includes('.git/HEAD'));
    assert.ok(!files.some((f) => f.startsWith('.git/objects')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('collectRepo does not follow symlinks', (t) => {
  const root = scratch();
  try {
    writeFileSync(join(root, 'real.txt'), 'x');
    try {
      symlinkSync(join(root, 'real.txt'), join(root, 'link.txt'));
    } catch {
      t.skip('symlink creation not permitted on this host');
      return;
    }
    const { files } = collectRepo(root);
    assert.ok(files.includes('real.txt'));
    assert.ok(!files.includes('link.txt'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('collectRepo read returns null above the size cap', () => {
  const root = scratch();
  try {
    writeFileSync(join(root, 'big.json'), 'x'.repeat(1_000_001));
    writeFileSync(join(root, 'small.json'), 'ok');
    const { read } = collectRepo(root);
    assert.equal(read('big.json'), null);
    assert.equal(read('small.json'), 'ok');
    assert.equal(read('missing.json'), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('collectRepo read rejects path traversal', () => {
  const root = scratch();
  try {
    writeFileSync(join(root, 'a.txt'), 'x');
    const { read } = collectRepo(root);
    assert.equal(read('../a.txt'), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

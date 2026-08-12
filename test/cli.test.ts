import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const hostile = fileURLToPath(new URL('./fixtures/hostile', import.meta.url));
const clean = fileURLToPath(new URL('./fixtures/clean', import.meta.url));

/** Run the built CLI as a real process — the only honest way to test a binary. */
function runCli(args: string[]) {
  const r = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

test('exits 1 when the hostile fixture has findings at or above --fail-on', () => {
  const r = runCli([hostile]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /execution paths/);
});

test('exits 0 on the clean fixture at the default threshold', () => {
  const r = runCli([clean]);
  assert.equal(r.status, 0);
});

test('--fail-on none never fails', () => {
  const r = runCli([hostile, '--fail-on', 'none']);
  assert.equal(r.status, 0);
});

test('--min high shows only high findings', () => {
  const r = runCli([hostile, '--min', 'high']);
  assert.ok(!/INFO/.test(r.stdout));
  assert.ok(/HIGH/.test(r.stdout));
});

test('--json emits a valid report with a summary', () => {
  const r = runCli([hostile, '--json']);
  const report = JSON.parse(r.stdout);
  assert.equal(report.tool, 'pretrust');
  assert.ok(report.summary.total > 0);
  assert.ok(report.summary.high >= 5);
  assert.ok(Array.isArray(report.findings));
});

test('--sarif emits valid SARIF 2.1.0', () => {
  const r = runCli([hostile, '--sarif']);
  const sarif = JSON.parse(r.stdout);
  assert.equal(sarif.version, '2.1.0');
  assert.ok(sarif.runs[0].results.length > 0);
  assert.equal(sarif.runs[0].tool.driver.name, 'pretrust');
});

test('--help prints usage and exits 0', () => {
  const r = runCli(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /USAGE/);
});

test('--version prints a version and exits 0', () => {
  const r = runCli(['--version']);
  assert.equal(r.status, 0);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('an unknown option exits 2', () => {
  const r = runCli(['--nope']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown option/);
});

test('a clean scan reports no auto-execution paths headline when filtered to high', () => {
  const r = runCli([clean, '--min', 'high']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /No auto-execution paths/);
});

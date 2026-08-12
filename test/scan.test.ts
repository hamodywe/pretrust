import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { scanRepo } from '../dist/scan/scan.js';

const hostile = fileURLToPath(new URL('./fixtures/hostile', import.meta.url));
const clean = fileURLToPath(new URL('./fixtures/clean', import.meta.url));

test('the hostile fixture yields multiple high-severity findings', () => {
  const result = scanRepo(hostile);
  const high = result.findings.filter((f) => f.severity === 'high');
  assert.ok(high.length >= 5, `expected >=5 high, got ${high.length}`);
  // Every surface with a planted danger is represented.
  const surfaces = new Set(high.map((f) => f.surface));
  for (const s of ['vscode-tasks', 'vscode-settings', 'devcontainer', 'npm-lifecycle', 'git-hooks', 'direnv']) {
    assert.ok(surfaces.has(s), `expected a high finding from ${s}`);
  }
});

test('the clean fixture produces inventory but never a high or medium finding', () => {
  const result = scanRepo(clean);
  assert.ok(result.findings.length > 0, 'clean fixture should still be mapped');
  const loud = result.findings.filter((f) => f.severity === 'high' || f.severity === 'medium');
  assert.deepEqual(
    loud,
    [],
    `clean fixture must not raise alarms, got: ${loud.map((f) => `${f.surface}:${f.severity}`).join(', ')}`,
  );
});

test('scanning is deterministic', () => {
  const a = scanRepo(hostile);
  const b = scanRepo(hostile);
  assert.deepEqual(a.findings, b.findings);
});

test('findings are sorted by severity', () => {
  const order = { high: 0, medium: 1, low: 2, info: 3 } as const;
  const result = scanRepo(hostile);
  for (let i = 1; i < result.findings.length; i++) {
    assert.ok(order[result.findings[i - 1]!.severity] <= order[result.findings[i]!.severity]);
  }
});

test('a remote-only MCP server is not reported as a local process', () => {
  const result = scanRepo(hostile);
  const mcpFindings = result.findings.filter((f) => f.surface === 'mcp');
  assert.equal(mcpFindings.length, 1);
  assert.ok(mcpFindings[0]!.title.includes('local-helper'));
});

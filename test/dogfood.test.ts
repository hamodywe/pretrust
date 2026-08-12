import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { scanRepo } from '../dist/scan/scan.js';

// Two levels up from test/ is the package root.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

test('scanning its own repository completes and is deterministic', () => {
  const a = scanRepo(repoRoot);
  const b = scanRepo(repoRoot);
  assert.deepEqual(a.findings, b.findings);
});

test('the self-scan reaches the intentionally-hostile fixtures', () => {
  const result = scanRepo(repoRoot);
  const fromFixtures = result.findings.filter((f) => f.file.includes('fixtures/hostile'));
  assert.ok(fromFixtures.length > 0, 'expected the hostile test fixtures to be discovered');
});

test('the self-scan does not descend into node_modules', () => {
  const result = scanRepo(repoRoot);
  assert.ok(!result.findings.some((f) => f.file.includes('node_modules')));
});

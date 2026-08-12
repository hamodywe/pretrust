import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseToml } from '../dist/parse/toml.js';

test('parses tables and string scalars', () => {
  const doc = parseToml('[core]\nmodel = "gpt"\n');
  assert.deepEqual(doc.value, { core: { model: 'gpt' } });
});

test('parses dotted table headers into nesting', () => {
  const doc = parseToml('[mcp_servers.docs]\ncommand = "npx"\n');
  const servers = (doc.value as any).mcp_servers;
  assert.deepEqual(servers.docs, { command: 'npx' });
});

test('parses single-line string arrays', () => {
  const doc = parseToml('notify = ["notify-send", "hi"]\n');
  assert.deepEqual((doc.value as any).notify, ['notify-send', 'hi']);
});

test('parses booleans and integers', () => {
  const doc = parseToml('enabled = true\ncount = 3\n');
  assert.equal((doc.value as any).enabled, true);
  assert.equal((doc.value as any).count, 3);
});

test('ignores comments and blank lines', () => {
  const doc = parseToml('# comment\n\n[a]\nx = "y"  # trailing\n');
  assert.deepEqual(doc.value, { a: { x: 'y' } });
});

test('array-of-tables headers append', () => {
  const doc = parseToml('[[servers]]\nname = "a"\n[[servers]]\nname = "b"\n');
  assert.deepEqual((doc.value as any).servers, [{ name: 'a' }, { name: 'b' }]);
});

test('locates a table header line', () => {
  const doc = parseToml('[a]\nx = 1\n[mcp_servers.docs]\ncommand = "npx"\n');
  assert.equal(doc.lineContaining('docs'), 3);
});

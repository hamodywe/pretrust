import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonc, asObject, asArray } from '../dist/parse/json.js';

test('parses plain JSON', () => {
  const doc = parseJsonc('{"a":1,"b":[2,3]}');
  assert.deepEqual(doc.value, { a: 1, b: [2, 3] });
});

test('tolerates line and block comments', () => {
  const raw = `{
    // a line comment
    "a": 1, /* inline */ "b": 2
  }`;
  const doc = parseJsonc(raw);
  assert.deepEqual(doc.value, { a: 1, b: 2 });
});

test('tolerates trailing commas in objects and arrays', () => {
  const doc = parseJsonc('{ "a": [1, 2, ], "b": 3, }');
  assert.deepEqual(doc.value, { a: [1, 2], b: 3 });
});

test('does not treat // inside a string as a comment', () => {
  const doc = parseJsonc('{ "url": "http://example.com/x" }');
  assert.deepEqual(doc.value, { url: 'http://example.com/x' });
});

test('does not treat a comma inside a string as a trailing comma', () => {
  const doc = parseJsonc('{ "a": "x,", "b": 1 }');
  assert.deepEqual(doc.value, { a: 'x,', b: 1 });
});

test('preserves line numbers across blanked comments', () => {
  const raw = ['{', '  /* block', '     spanning */', '  "target": 1', '}'].join('\n');
  const doc = parseJsonc(raw);
  assert.equal(doc.lineContaining('"target"'), 4);
});

test('throws on malformed input', () => {
  assert.throws(() => parseJsonc('{ "a": }'));
});

test('asObject and asArray narrow correctly', () => {
  assert.deepEqual(asObject({ a: 1 }), { a: 1 });
  assert.equal(asObject([1]), null);
  assert.equal(asObject(null), null);
  assert.deepEqual(asArray([1, 2]), [1, 2]);
  assert.equal(asArray({ a: 1 }), null);
});

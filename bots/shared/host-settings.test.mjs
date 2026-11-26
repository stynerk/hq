import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ecosystem from '../ecosystem.config.cjs';
import {configuredPath, dpapi, macDiscordToken, readMacEnv, windowsAppData} from './host-settings.mjs';
import {loadRegistry} from './registry.mjs';

function setDotenvPath(t, file) {
  const previous = process.env.HQ_BOTS_ENV_FILE;
  t.after(() => {
    if (previous === undefined) delete process.env.HQ_BOTS_ENV_FILE;
    else process.env.HQ_BOTS_ENV_FILE = previous;
  });
  if (file === undefined) delete process.env.HQ_BOTS_ENV_FILE;
  else process.env.HQ_BOTS_ENV_FILE = file;
}

test('PM2 launches tony and cap from bots with only the protected dotenv path', () => {
  const cwd = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
  const env = {HQ_BOTS_ENV_FILE: path.join(cwd, '.env')};
  assert.deepEqual(ecosystem.apps, [
    {name: 'tony', script: 'claude-relay/relay.mjs', cwd, env},
    {name: 'cap', script: 'codex-bridge/bridge.mjs', cwd, env},
  ]);
});

test('explicit process paths override dotenv settings and expand home without splitting spaces', () => {
  const value = '~/Library/Application Support/orca/codex-accounts';
  const expected = path.join(os.homedir(), 'Library', 'Application Support', 'orca', 'codex-accounts');
  assert.equal(configuredPath('CODEX_ACCOUNTS_ROOT', {CODEX_ACCOUNTS_ROOT: value}, {}), expected);
  assert.equal(configuredPath('CODEX_ACCOUNTS_ROOT', {CODEX_ACCOUNTS_ROOT: '/default'}, {CODEX_ACCOUNTS_ROOT: value}), expected);
  assert.equal(windowsAppData({}, 'C:\\Users\\example'), 'C:\\Users\\example\\AppData\\Roaming');
});

test('configured dotenv path validates mode, owner and symlink failure before reading credentials', t => {
  const file = path.join(os.tmpdir(), 'HQ Settings', '.env');
  setDotenvPath(t, file);
  const uid = 123;
  if (typeof process.getuid === 'function') {
    t.mock.method(process, 'getuid', () => uid);
  } else {
    process.getuid = () => uid;
    t.after(() => { delete process.getuid; });
  }

  const fd = 1234;
  const stat = {isFile: () => true, mode: 0o600, uid};
  const open = t.mock.method(fs, 'openSync', () => fd);
  t.mock.method(fs, 'fstatSync', () => stat);
  const close = t.mock.method(fs, 'closeSync', () => {});
  const read = t.mock.method(fs, 'readFileSync', () =>
    'CODEX_DISCORD_BOT_TOKEN=synthetic-value\nHQ_ROOT="/tmp/Project Folder"\n');

  const settings = readMacEnv();
  assert.deepEqual(open.mock.calls[0].arguments, [file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK]);
  assert.deepEqual(read.mock.calls[0].arguments, [fd, 'utf8']);
  assert.equal(settings.HQ_ROOT, '/tmp/Project Folder');
  assert.equal(macDiscordToken(settings, 'CODEX_DISCORD_BOT_TOKEN'), 'synthetic-value');
  assert.throws(() => macDiscordToken(settings, 'CLAUDE_DISCORD_BOT_TOKEN'), /CLAUDE_DISCORD_BOT_TOKEN/);

  stat.mode = 0o644;
  assert.throws(() => readMacEnv(), /0600/);
  stat.mode = 0o600;
  stat.uid = uid + 1;
  assert.throws(() => readMacEnv(), /현재 사용자 소유/);
  stat.uid = uid;
  open.mock.mockImplementationOnce(() => {
    throw Object.assign(new Error('ELOOP: synthetic-value'), {code: 'ELOOP'});
  });
  assert.throws(() => readMacEnv(), error => /0600/.test(error.message) && !error.message.includes('synthetic-value'));
  assert.equal(read.mock.callCount(), 1);
  assert.deepEqual(close.mock.calls.map(call => call.arguments), [[fd], [fd], [fd]]);
});

test('dotenv path defaults to bots/.env when no environment override is set', t => {
  setDotenvPath(t, undefined);
  const expected = fileURLToPath(new URL('../.env', import.meta.url));
  const open = t.mock.method(fs, 'openSync', () => {
    throw Object.assign(new Error('fixture file unavailable'), {code: 'ENOENT'});
  });
  assert.throws(() => readMacEnv(), /0600/);
  assert.equal(open.mock.calls[0].arguments[0], expected);
  assert.equal(open.mock.callCount(), 1);
});

test('configured dotenv path enforces POSIX mode and a symlink fails to open', {skip: process.platform === 'win32'}, t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-dotenv-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'HQ_ROOT="/tmp/Project Folder"\n', {mode: 0o600});
  setDotenvPath(t, file);
  assert.equal(readMacEnv().HQ_ROOT, '/tmp/Project Folder');
  fs.chmodSync(file, 0o644);
  assert.throws(() => readMacEnv(), /0600/);
  fs.chmodSync(file, 0o600);
  const link = path.join(dir, 'symlink.env');
  fs.symlinkSync(file, link);
  process.env.HQ_BOTS_ENV_FILE = link;
  assert.throws(() => readMacEnv(), /0600/);
});

test('Windows DPAPI round-trips generated data under the current user', {skip: process.platform !== 'win32'}, async () => {
  const dummy = randomUUID();
  const encrypted = await dpapi(dummy);
  assert.ok(encrypted);
  assert.notEqual(encrypted, dummy);
  assert.equal(await dpapi(encrypted, true), dummy);
});

test('legacy Windows registry paths resolve to sibling checkouts only on macOS', t => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-paths-'));
  t.after(() => fs.rmSync(parent, {recursive: true, force: true}));
  const root = path.join(parent, 'HQ root with spaces');
  fs.mkdirSync(path.join(root, 'config'), {recursive: true});
  fs.mkdirSync(path.join(root, 'projects'));
  fs.writeFileSync(path.join(root, 'config', 'discord.md'), '');
  const fixtures = {
    hq: 'C:/old/hq',
    other: 'C:/old/Other Project',
    explicit: '/path/with spaces/Explicit Project',
  };
  for (const [slug, value] of Object.entries(fixtures)) {
    fs.writeFileSync(path.join(root, 'projects', slug + '.md'), '---\nslug: ' + slug + '\nlocal_path: ' + value + '\n---\n');
  }
  const paths = platform => Object.fromEntries(loadRegistry(root, {platform}).projects.map(p => [p.slug, p.localPath]));
  assert.deepEqual(paths('win32'), fixtures);
  assert.deepEqual(paths('darwin'), {hq: root, other: path.join(parent, 'Other Project'), explicit: fixtures.explicit});
});

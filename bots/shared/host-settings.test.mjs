import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {configuredPath, dpapi, macDiscordToken, readMacEnv, windowsAppData} from './host-settings.mjs';
import {loadRegistry} from './registry.mjs';

test('explicit process paths override dotenv settings and expand home without splitting spaces', () => {
  const value = '~/Library/Application Support/orca/codex-accounts';
  const expected = path.join(os.homedir(), 'Library', 'Application Support', 'orca', 'codex-accounts');
  assert.equal(configuredPath('CODEX_ACCOUNTS_ROOT', {CODEX_ACCOUNTS_ROOT: value}, {}), expected);
  assert.equal(configuredPath('CODEX_ACCOUNTS_ROOT', {CODEX_ACCOUNTS_ROOT: '/default'}, {CODEX_ACCOUNTS_ROOT: value}), expected);
  assert.equal(windowsAppData({}, 'C:\\Users\\example'), 'C:\\Users\\example\\AppData\\Roaming');
});

test('dotenv loader requires owner-only mode, preserves quotes and excludes token values from errors', {skip: process.platform === 'win32'}, t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-dotenv-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'CODEX_DISCORD_BOT_TOKEN=synthetic-value\nHQ_ROOT="/tmp/Project Folder"\n', {mode: 0o600});
  const settings = readMacEnv(file);
  assert.equal(settings.HQ_ROOT, '/tmp/Project Folder');
  assert.equal(macDiscordToken(settings, 'CODEX_DISCORD_BOT_TOKEN'), 'synthetic-value');
  assert.throws(() => macDiscordToken(settings, 'CLAUDE_DISCORD_BOT_TOKEN'), {message: /CLAUDE_DISCORD_BOT_TOKEN/});
  fs.chmodSync(file, 0o644);
  assert.throws(() => readMacEnv(file), error => /0600/.test(error.message) && !error.message.includes('synthetic-value'));
  fs.chmodSync(file, 0o600);
  const link = path.join(dir, 'symlink.env');
  fs.symlinkSync(file, link);
  assert.throws(() => readMacEnv(link), /0600/);
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

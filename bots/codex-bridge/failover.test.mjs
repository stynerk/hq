import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {configureRouting, defaultAccountsRoot, ProfileServers, isUsageLimit} from './profiles.mjs';

test('isUsageLimit recognises request errors and turn errors only for usage limits', () => {
  assert.ok(isUsageLimit(new Error("You've hit your usage limit. Upgrade or try again later.")));
  assert.ok(isUsageLimit({message: 'x', codexErrorInfo: 'usageLimitExceeded'}));
  assert.equal(isUsageLimit(new Error('no rollout found for thread id 1')), false);
  assert.equal(isUsageLimit(null), false);
});

test('rotateBusiness moves to the next business home, closes the old server quietly, and wraps around', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rot-'));
  const file = path.join(dir, 'routing.json');
  fs.writeFileSync(file, JSON.stringify({businessOnly: true, profiles: {business: {home: 'A', homes: ['A', 'B']}}}));
  const made = [];
  const factory = home => { const s = new EventEmitter(); s.home = home; s.closed = false;
    s.initialize = async () => {}; s.request = async () => ({account: {type: 'chatgpt', planType: 'business'}});
    s.close = () => { s.closed = true; s.emit('disconnected'); }; made.push(s); return s; };
  const rpc = new ProfileServers(file, factory);
  let disconnected = 0; rpc.on('disconnected', () => disconnected++);
  await rpc.backend('business');
  assert.equal(made[0].home, 'A');
  assert.equal(rpc.rotateBusiness(), 'B');
  await new Promise(r => setImmediate(r));
  assert.equal(made[0].closed, true);
  assert.equal(disconnected, 0, 'intentional close must not trigger the bridge restart');
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).profiles.business.home, 'B');
  await rpc.backend('business');
  assert.equal(made[1].home, 'B');
  assert.equal(rpc.rotateBusiness(), 'A');
  fs.rmSync(dir, {recursive: true, force: true});
});

test('routing defaults honor the macOS account path and retain explicit profile homes when the root changes', () => {
  const macDefault = defaultAccountsRoot({platform: 'darwin', env: {}, home: '/Users/example'});
  assert.equal(macDefault, '/Users/example/Library/Application Support/orca/codex-accounts');
  assert.equal(defaultAccountsRoot({platform: 'win32', env: {APPDATA: 'D:\\App Data'}}), 'D:\\App Data\\orca\\codex-accounts');
  const first = macDefault + '/First Home';
  const secondRoot = '/Volumes/Other Drive/Codex Accounts';
  const base = configureRouting(null, {workspace: '/hq', accountsRoot: macDefault});
  assert.equal(base.managedAccountsRoot, macDefault);
  base.profiles.business = {home: first, workspace: '/hq', discoveredHome: first};
  assert.equal(configureRouting(base, {workspace: '/hq'}), base);
  const relocated = configureRouting(base, {workspace: '/hq', accountsRoot: secondRoot});
  assert.equal(relocated.managedAccountsRoot, secondRoot);
  assert.deepEqual(relocated.profiles.business, {home: null, workspace: '/hq'});
  base.profiles.business.homes = [first];
  assert.equal(configureRouting(base, {workspace: '/hq', accountsRoot: secondRoot}).profiles.business.home, first);
});

test('a mocked usage limit switches to the next discovered home with spaces and updates routing.json', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-mac-failover-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const root = path.join(dir, 'Library', 'Application Support', 'orca', 'codex-accounts');
  const first = path.join(root, 'A Business Account');
  const second = path.join(root, 'B Business Account');
  const personal = path.join(root, 'C Personal Account');
  for (const [home, plan] of [[first, 'business'], [second, 'business'], [personal, 'plus']]) {
    fs.mkdirSync(home, {recursive: true});
    const claims = Buffer.from(JSON.stringify({'https://api.openai.com/auth': {chatgpt_plan_type: plan}})).toString('base64url');
    fs.writeFileSync(path.join(home, 'auth.json'), JSON.stringify({tokens: {id_token: 'fixture.' + claims + '.fixture'}}));
  }
  const file = path.join(dir, 'routing.json');
  fs.writeFileSync(file, JSON.stringify(configureRouting(null, {accountsRoot: root, workspace: dir})));
  const factory = home => {
    const server = new EventEmitter();
    server.initialize = async () => {};
    server.close = () => {};
    server.request = async method => {
      if (method === 'account/read') return {account: {type: 'chatgpt', planType: 'business'}};
      if (home === first) throw new Error('usage limit exceeded');
      return {home};
    };
    return server;
  };
  const pool = new ProfileServers(file, factory, {discoverFailover: true});
  try {
    await pool.initialize();
    assert.equal(pool.routing().profiles.business.home, first);
    await assert.rejects(pool.request('turn/start'), isUsageLimit);
    assert.equal(pool.rotateBusiness(), second);
    assert.equal(pool.routing().managedAccountsRoot, root);
    assert.equal(pool.routing().profiles.business.home, second);
    assert.deepEqual(await pool.request('turn/start'), {home: second});
    assert.equal(pool.rotateBusiness(), first, 'personal accounts are not eligible');
  } finally { pool.close(); }
});

test('rotateBusiness does nothing without a second account', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rot-'));
  const file = path.join(dir, 'routing.json');
  fs.writeFileSync(file, JSON.stringify({businessOnly: true, profiles: {business: {home: 'A'}}}));
  assert.equal(new ProfileServers(file, () => { throw new Error('unused'); }).rotateBusiness(), null);
  fs.rmSync(dir, {recursive: true, force: true});
});

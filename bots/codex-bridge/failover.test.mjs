import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {ProfileServers, isUsageLimit} from './profiles.mjs';

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

test('rotateBusiness does nothing without a second account', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rot-'));
  const file = path.join(dir, 'routing.json');
  fs.writeFileSync(file, JSON.stringify({businessOnly: true, profiles: {business: {home: 'A'}}}));
  assert.equal(new ProfileServers(file, () => { throw new Error('unused'); }).rotateBusiness(), null);
  fs.rmSync(dir, {recursive: true, force: true});
});

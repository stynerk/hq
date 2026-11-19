import test from 'node:test';
import assert from 'node:assert/strict';
import {startWatchdog, discordReady} from './watchdog.mjs';

const harness = ready => {
  let t = 0, exits = 0; const logs = [];
  const w = startWatchdog({isReady: () => ready.value, exit: () => exits++, now: () => t, log: m => logs.push(m), setIntervalFn: () => 1, clearIntervalFn: () => {}});
  return {w, advance: ms => { t += ms; w.tick(); }, exits: () => exits, logs};
};

test('stays quiet while connected', () => {
  const r = {value: true}; const h = harness(r);
  for (let i = 0; i < 10; i++) h.advance(60_000);
  assert.equal(h.exits(), 0);
});

test('restarts after five minutes disconnected, once', () => {
  const r = {value: false}; const h = harness(r);
  for (let i = 0; i < 5; i++) h.advance(60_000);
  assert.equal(h.exits(), 0);
  h.advance(60_000); h.advance(60_000);
  assert.equal(h.exits(), 1);
  assert.match(h.logs[0], /연결이/);
});

test('a short drop that recovers does not restart', () => {
  const r = {value: false}; const h = harness(r);
  h.advance(60_000); h.advance(60_000);
  r.value = true; h.advance(60_000);
  r.value = false; for (let i = 0; i < 4; i++) h.advance(60_000);
  assert.equal(h.exits(), 0);
});

test('restarts right after waking from sleep even if it looks connected', () => {
  const r = {value: true}; const h = harness(r);
  h.advance(60_000); h.advance(4 * 3600_000);
  assert.equal(h.exits(), 1);
  assert.match(h.logs[0], /절전/);
});

test('discordReady needs a ready client with READY websocket', () => {
  assert.equal(discordReady(null), false);
  assert.equal(discordReady({isReady: () => true, ws: {status: 0}}), true);
  assert.equal(discordReady({isReady: () => true, ws: {status: 5}}), false);
  assert.equal(discordReady({isReady: () => false, ws: {status: 0}}), false);
});

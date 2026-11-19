import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeIdle, idleDelay, idleDue, recordActivity, recordCheck, isNoop, idlePrompt} from './idle.mjs';

const MIN = 60 * 1000;
const idle = normalizeIdle('oms', {after_minutes: 30, max_minutes: 120}).idle;

test('normalizeIdle validates and defaults max to four times after', () => {
  assert.deepEqual(normalizeIdle('oms', undefined), {idle: null, errors: []});
  assert.deepEqual(normalizeIdle('oms', {after_minutes: 30}).idle, {afterMs: 30 * MIN, maxMs: 120 * MIN});
  assert.equal(normalizeIdle('oms', {after_minutes: 2}).errors.length, 1);
  assert.equal(normalizeIdle('oms', {after_minutes: 30, max_minutes: 10}).errors.length, 1);
  assert.equal(normalizeIdle('oms', {}).errors.length, 1);
});

test('idleDelay backs off 30 → 60 → 120 and stops at max', () => {
  assert.equal(idleDelay(idle, 0), 30 * MIN);
  assert.equal(idleDelay(idle, 1), 60 * MIN);
  assert.equal(idleDelay(idle, 2), 120 * MIN);
  assert.equal(idleDelay(idle, 5), 120 * MIN);
});

test('no record means no check (no run right after start)', () => {
  assert.equal(idleDue(idle, undefined, 10 * 60 * MIN), false);
  assert.equal(idleDue(idle, {}, 10 * 60 * MIN), false);
  assert.equal(idleDue(null, {activityAt: 0}, 10 * 60 * MIN), false);
});

test('checks after 30 quiet minutes, then backs off until activity resets it', () => {
  let e = recordActivity(undefined, 0);
  assert.equal(idleDue(idle, e, 29 * MIN), false);
  assert.equal(idleDue(idle, e, 30 * MIN), true);
  e = recordCheck(e, 30 * MIN); // streak 1 → 60분
  assert.equal(idleDue(idle, e, 89 * MIN), false);
  assert.equal(idleDue(idle, e, 90 * MIN), true);
  e = recordCheck(e, 90 * MIN); // streak 2 → 120분
  assert.equal(idleDue(idle, e, 209 * MIN), false);
  assert.equal(idleDue(idle, e, 210 * MIN), true);
  e = recordActivity(e, 215 * MIN); // HJ·Cap 글 → 처음으로
  assert.equal(e.streak, 0);
  assert.equal(idleDue(idle, e, 244 * MIN), false);
  assert.equal(idleDue(idle, e, 245 * MIN), true);
});

test('isNoop accepts NOOP with spacing, case or a trailing period only', () => {
  assert.equal(isNoop('NOOP'), true);
  assert.equal(isNoop('  noop.\n'), true);
  assert.equal(isNoop('NOOP 대기 중'), false);
  assert.equal(isNoop(''), false);
});

test('idlePrompt names the minutes, owner mention and NOOP rule', () => {
  const p = idlePrompt(30, '565');
  assert.match(p, /30분 넘게 조용/);
  assert.match(p, /<@565>/);
  assert.match(p, /NOOP 한 단어만/);
});

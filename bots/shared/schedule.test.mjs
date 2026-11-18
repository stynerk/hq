import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSchedules, latestOccurrence, dueRuns, scheduleKey, describeSchedules} from './schedule.mjs';

// KST 시각을 epoch ms로.
const kst = (y, mo, d, h, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h - 9, mi, s);
const project = (over = {}) => ({
  slug: 'oms', status: 'active', channelId: '111',
  schedules: [{id: 'c10', at: '10:00', prompt: '점검'}, {id: 'c15', at: '15:00', prompt: '점검'}],
  ...over,
});

test('normalizeSchedules keeps valid entries and reports bad ones', () => {
  const {schedules, errors} = normalizeSchedules('oms', [
    {id: 'a', at: '10:00', prompt: 'p'},
    {id: 'b', at: '25:00', prompt: 'p'},
    {id: 'a', at: '11:00', prompt: 'p'},
    {at: '12:00', prompt: 'p'},
  ]);
  assert.deepEqual(schedules, [{id: 'a', at: '10:00', prompt: 'p'}]);
  assert.equal(errors.length, 3);
  assert.deepEqual(normalizeSchedules('oms', undefined), {schedules: [], errors: []});
  assert.equal(normalizeSchedules('oms', {}).errors.length, 1);
});

test('latestOccurrence uses KST and includes the exact minute', () => {
  assert.equal(latestOccurrence('10:00', kst(2026, 11, 19, 10, 0)), kst(2026, 11, 19, 10, 0));
  assert.equal(latestOccurrence('10:00', kst(2026, 11, 19, 9, 59)), kst(2026, 11, 18, 10, 0));
  // KST 새벽 1시는 UTC로 전날이다.
  assert.equal(latestOccurrence('18:00', kst(2026, 11, 19, 1, 0)), kst(2026, 11, 18, 18, 0));
  assert.equal(latestOccurrence('00:00', kst(2026, 11, 19, 0, 0, 30)), kst(2026, 11, 19, 0, 0));
});

test('first sighting only sets a baseline, then runs on the next occurrence once', () => {
  const p = project();
  let state = {runs: {}, paused: {}};
  let r = dueRuns([p], state, kst(2026, 11, 19, 11, 0));
  assert.equal(r.due.length, 0);
  state = {...state, runs: r.runs};
  r = dueRuns([p], state, kst(2026, 11, 19, 14, 59));
  assert.equal(r.due.length, 0);
  r = dueRuns([p], state, kst(2026, 11, 19, 15, 0, 20));
  assert.deepEqual(r.due.map(d => d.schedule.id), ['c15']);
  assert.equal(r.due[0].occurrence, kst(2026, 11, 19, 15, 0));
  state = {...state, runs: r.runs};
  // 같은 회차를 다시 확인해도(재시작 포함) 두 번 돌지 않는다.
  assert.equal(dueRuns([p], state, kst(2026, 11, 19, 15, 0, 50)).due.length, 0);
});

test('missed occurrences run only the latest one', () => {
  const p = project({schedules: [{id: 'c10', at: '10:00', prompt: '점검'}]});
  const state = {runs: {[scheduleKey('oms', 'c10')]: kst(2026, 11, 17, 10, 0)}, paused: {}};
  const r = dueRuns([p], state, kst(2026, 11, 19, 12, 0));
  assert.equal(r.due.length, 1);
  assert.equal(r.due[0].occurrence, kst(2026, 11, 19, 10, 0));
});

test('paused projects skip occurrences and do not catch up after resume', () => {
  const p = project({schedules: [{id: 'c10', at: '10:00', prompt: '점검'}]});
  const key = scheduleKey('oms', 'c10');
  let state = {runs: {[key]: kst(2026, 11, 18, 10, 0)}, paused: {oms: true}};
  let r = dueRuns([p], state, kst(2026, 11, 19, 10, 1));
  assert.equal(r.due.length, 0);
  assert.equal(r.runs[key], kst(2026, 11, 19, 10, 0));
  state = {runs: r.runs, paused: {}};
  assert.equal(dueRuns([p], state, kst(2026, 11, 19, 10, 2)).due.length, 0);
  assert.equal(dueRuns([p], state, kst(2026, 11, 20, 10, 0)).due.length, 1);
});

test('inactive projects and projects without a channel never run', () => {
  const state = {runs: {[scheduleKey('oms', 'c10')]: 0}, paused: {}};
  const now = kst(2026, 11, 19, 10, 5);
  assert.equal(dueRuns([project({status: 'paused'})], state, now).due.length, 0);
  assert.equal(dueRuns([project({channelId: null})], state, now).due.length, 0);
  assert.equal(dueRuns([project()], state, now).due.length, 1);
});

test('dueRuns does not mutate the given state', () => {
  const state = {runs: {}, paused: {}};
  dueRuns([project()], state, kst(2026, 11, 19, 11, 0));
  assert.deepEqual(state.runs, {});
});

test('describeSchedules lists times, last run and pause state', () => {
  const text = describeSchedules(project(), {runs: {[scheduleKey('oms', 'c10')]: kst(2026, 11, 19, 10, 0)}, paused: {oms: true}}, kst(2026, 11, 19, 11, 0));
  assert.match(text, /일시 중지/);
  assert.match(text, /10:00 KST \(c10\) 마지막 회차: 2026-11-19 10:00/);
  assert.match(text, /15:00 KST \(c15\) 마지막 회차: 없음/);
  assert.match(describeSchedules(project({schedules: []}), {}, 0), /등록된 예약이 없습니다/);
});

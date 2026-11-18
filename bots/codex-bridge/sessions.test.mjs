import test from 'node:test';
import assert from 'node:assert/strict';
import {openThread, isMissingThread} from './sessions.mjs';

const fakeRpc = ({resumeError} = {}) => {
  const calls = [];
  return {calls, async request(method, params) {
    calls.push(method);
    if (method === 'thread/start') return {thread: {id: 'new-' + calls.length}};
    if (method === 'thread/resume' && resumeError) throw new Error(resumeError);
    return {};
  }};
};

test('starts a thread when none is saved', async () => {
  const rpc = fakeRpc(); const s = {}; let saved = 0;
  const r = await openThread(rpc, s, 'k', {}, () => saved++);
  assert.equal(r.reset, false); assert.equal(s.k, r.threadId); assert.equal(saved, 1);
  assert.deepEqual(rpc.calls, ['thread/start']);
});

test('resumes a saved thread', async () => {
  const rpc = fakeRpc(); const s = {k: 'old'};
  assert.deepEqual(await openThread(rpc, s, 'k', {}), {threadId: 'old', reset: false});
  assert.deepEqual(rpc.calls, ['thread/resume']);
});

test('starts fresh when the saved thread is missing after an account switch', async () => {
  const rpc = fakeRpc({resumeError: 'no rollout found for thread id 01a1e4fc'}); const s = {k: 'old'};
  const r = await openThread(rpc, s, 'k', {});
  assert.equal(r.reset, true); assert.notEqual(s.k, 'old'); assert.equal(s.k, r.threadId);
  assert.deepEqual(rpc.calls, ['thread/resume', 'thread/start']);
});

test('other resume errors are not swallowed', async () => {
  const rpc = fakeRpc({resumeError: 'usage limit reached'}); const s = {k: 'old'};
  await assert.rejects(openThread(rpc, s, 'k', {}), /usage limit/);
  assert.equal(s.k, 'old');
  assert.equal(isMissingThread(new Error('usage limit reached')), false);
});

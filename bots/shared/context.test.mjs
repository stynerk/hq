import test from 'node:test';
import assert from 'node:assert/strict';
import {siblingChannels, formatContext, originLine} from './context.mjs';

const ids = {ownerId: '1', claudeBotId: '2', codexBotId: '3'};
const at = (h, mi = 0) => Date.UTC(2026, 10, 19, h - 9, mi); // KST 11-19 h:mi

test('siblingChannels excludes the current channel and missing ids', () => {
  const p = {channelId: 'main', devThreadId: 'dev'};
  assert.deepEqual(siblingChannels(p, 'main').map(c => c.id), ['dev']);
  assert.deepEqual(siblingChannels(p, 'dev').map(c => c.id), ['main']);
  assert.deepEqual(siblingChannels(p, 'other-thread').map(c => c.id), ['main', 'dev']);
  assert.deepEqual(siblingChannels({channelId: 'main', devThreadId: null}, 'main'), []);
});

test('formatContext labels HJ, Tony and Cap with KST times', () => {
  const text = formatContext([{label: 'dev 스레드', messages: [
    {authorId: '2', content: 'TASK_READY #32', createdAt: at(10, 5)},
    {authorId: '3', content: '#32 진행 중', createdAt: at(10, 7)},
    {authorId: '1', content: '좋아요', createdAt: at(10, 9)},
    {authorId: '9', authorName: 'someone', content: '안녕', createdAt: at(10, 10)},
    {authorId: '3', content: '   ', createdAt: at(10, 11)},
  ]}], ids);
  assert.match(text, /^\[같은 프로젝트의 다른 채널/);
  assert.match(text, /### dev 스레드\n- 11-19 10:05 Tony: TASK_READY #32\n- 11-19 10:07 Cap: #32 진행 중\n- 11-19 10:09 HJ: 좋아요\n- 11-19 10:10 someone: 안녕$/);
});

test('formatContext returns empty when there is nothing new', () => {
  assert.equal(formatContext([], ids), '');
  assert.equal(formatContext([{label: 'x', messages: [{authorId: '1', content: '', createdAt: 0}]}], ids), '');
});

test('formatContext keeps the latest lines within the budget and marks omissions', () => {
  const messages = Array.from({length: 10}, (_, i) => ({authorId: '3', content: 'm' + i + 'x'.repeat(40), createdAt: at(10, i)}));
  const text = formatContext([{label: 'dev 스레드', messages}], {...ids, maxChars: 200});
  assert.match(text, /더 오래된 기록은 생략/);
  assert.match(text, /m9x/);
  assert.doesNotMatch(text, /m0x/);
  const truncated = formatContext([{label: 'dev 스레드', truncated: true, messages: messages.slice(0, 1)}], ids);
  assert.match(truncated, /더 오래된 기록은 생략/);
});

test('formatContext clips very long messages', () => {
  const text = formatContext([{label: 'dev 스레드', messages: [{authorId: '3', content: 'a'.repeat(50), createdAt: at(10)}]}], {...ids, maxPerMessage: 10});
  assert.match(text, /a{10} …\(생략\)/);
});

test('originLine names the place', () => {
  assert.equal(originLine('dev'), '[이 요청이 온 곳: dev 스레드]');
  assert.equal(originLine('main'), '[이 요청이 온 곳: 프로젝트 채널]');
  assert.equal(originLine('thread'), '[이 요청이 온 곳: 프로젝트 채널의 스레드]');
});

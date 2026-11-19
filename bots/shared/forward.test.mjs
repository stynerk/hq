import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerParagraphs, forwardMessage, startNotice} from './forward.mjs';

const OWNER = '565583270448988163';

test('ownerParagraphs keeps only paragraphs that mention the owner', () => {
  const text = `<@1563059804082282516> TASK_READY #32\n요약 한 줄\n\n진행 상황 보고.\n\n<@${OWNER}> 결정 필요: A 또는 B, 추천 A.\n선택지 설명\n\n다음 작업.`;
  assert.deepEqual(ownerParagraphs(text, OWNER), [`<@${OWNER}> 결정 필요: A 또는 B, 추천 A.\n선택지 설명`]);
});

test('ownerParagraphs accepts the <@!id> form and CRLF, and keeps order', () => {
  const text = `첫 문단 <@!${OWNER}>\r\n\r\n중간\r\n\r\n끝 <@${OWNER}>`;
  assert.deepEqual(ownerParagraphs(text, OWNER), [`첫 문단 <@!${OWNER}>`, `끝 <@${OWNER}>`]);
});

test('ownerParagraphs treats a fenced code block as one paragraph', () => {
  const text = `<@${OWNER}> 실행해 주세요:\n\`\`\`\nnpm ci\n\nnpm test\n\`\`\`\n\n다른 문단`;
  assert.deepEqual(ownerParagraphs(text, OWNER), [`<@${OWNER}> 실행해 주세요:\n\`\`\`\nnpm ci\n\nnpm test\n\`\`\``]);
});

test('ownerParagraphs ignores other user ids and empty input', () => {
  assert.deepEqual(ownerParagraphs(`<@1${OWNER}> 아님`, OWNER), []);
  assert.deepEqual(ownerParagraphs('', OWNER), []);
  assert.deepEqual(ownerParagraphs(`<@${OWNER}>`, null), []);
});

test('forwardMessage adds a source line or returns null', () => {
  assert.equal(forwardMessage('멘션 없음', {ownerId: OWNER, devThreadId: '9'}), null);
  assert.equal(forwardMessage(`<@${OWNER}> 확인`, {ownerId: OWNER, devThreadId: '9'}), `<#9>에서 HJ 확인이 필요한 내용을 옮깁니다.\n\n<@${OWNER}> 확인`);
  assert.match(forwardMessage(`<@${OWNER}> 확인`, {ownerId: OWNER, devThreadId: null}), /^dev 스레드에서/);
});

test('startNotice formats the hour', () => {
  assert.equal(startNotice('06:00'), '6시 예약 점검 진행합니다.');
  assert.equal(startNotice('15:00'), '15시 예약 점검 진행합니다.');
  assert.equal(startNotice('00:00'), '0시 예약 점검 진행합니다.');
  assert.equal(startNotice('09:30'), '9시 30분 예약 점검 진행합니다.');
});

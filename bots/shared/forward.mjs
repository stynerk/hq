// dev 스레드의 답 중 HJ가 봐야 할 문단을 프로젝트 채널로 옮기는 문구 만들기 (hq Issue #20, HJ 결정 2026-11-19).
// 디스코드를 부르지 않는 순수 함수라 테스트할 수 있다.

const mentionRe = id => new RegExp(`<@!?${id}>`);

/** 빈 줄로 나눈 문단 중 HJ 멘션이 들어간 것만 원래 순서대로. 코드 블록은 한 문단으로 다룬다. */
export function ownerParagraphs(text, ownerId) {
  if (!ownerId || !text) return [];
  const re = mentionRe(ownerId);
  const blocks = [];
  let cur = [];
  let inFence = false;
  for (const line of String(text).replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (!inFence && line.trim() === '' ) { if (cur.length) { blocks.push(cur.join('\n')); cur = []; } continue; }
    cur.push(line);
  }
  if (cur.length) blocks.push(cur.join('\n'));
  return blocks.filter(b => re.test(b));
}

/** 프로젝트 채널에 올릴 글. 옮길 문단이 없으면 null. */
export function forwardMessage(text, {ownerId, devThreadId}) {
  const parts = ownerParagraphs(text, ownerId);
  if (!parts.length) return null;
  const from = devThreadId ? `<#${devThreadId}>` : 'dev 스레드';
  return [`${from}에서 HJ 확인이 필요한 내용을 옮깁니다.`, ...parts].join('\n\n');
}

/** 예약 점검 시작 알림. at은 "HH:MM". */
export function startNotice(at) {
  const [hh, mm] = String(at).split(':');
  const hour = Number(hh);
  return mm && mm !== '00' ? `${hour}시 ${Number(mm)}분 예약 점검 진행합니다.` : `${hour}시 예약 점검 진행합니다.`;
}

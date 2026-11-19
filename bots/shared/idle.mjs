// dev 스레드 무응답 점검 (HJ 결정 2026-11-19). 순수 함수라 테스트할 수 있다.
// 정의: projects/<slug>.md 프론트매터
//   idle_check:
//     after_minutes: 30   # 이만큼 조용하면 점검
//     max_minutes: 120    # 반응이 없으면 30 → 60 → 120분으로 늘리고, 그 위로는 늘리지 않는다
// 활동: dev 스레드에 HJ·Cap·서비스PM이 쓴 글(무응답 점검이 올린 글은 빼고). 활동이 있으면 간격을 처음으로 되돌린다.
// 점검했는데 할 일이 없으면 서비스PM은 NOOP만 답하고 릴레이는 아무것도 올리지 않는다.

export const IDLE_NOOP = 'NOOP';
const MIN = 60 * 1000;

/** 프론트매터 값 검사. 없으면 null(꺼짐). */
export function normalizeIdle(slug, raw) {
  if (raw === undefined || raw === null || raw === false) return {idle: null, errors: []};
  const after = Number(raw?.after_minutes);
  const max = raw?.max_minutes === undefined ? after * 4 : Number(raw.max_minutes);
  if (!Number.isFinite(after) || after < 5 || !Number.isFinite(max) || max < after) {
    return {idle: null, errors: [`${slug}: idle_check에 after_minutes(5 이상)와 max_minutes(after_minutes 이상)가 필요하다`]};
  }
  return {idle: {afterMs: after * MIN, maxMs: max * MIN}, errors: []};
}

/** 이번 간격(ms): after × 2^streak, max에서 멈춘다. */
export const idleDelay = (idle, streak = 0) => Math.min(idle.afterMs * 2 ** Math.max(0, streak), idle.maxMs);

/** 지금 점검할지. entry: {activityAt, checkAt, streak}. 기록이 없으면 점검하지 않는다(시작 직후 바로 돌지 않게). */
export function idleDue(idle, entry, now) {
  if (!idle || !entry || entry.activityAt === undefined) return false;
  const since = Math.max(entry.activityAt, entry.checkAt ?? 0);
  return now - since >= idleDelay(idle, entry.streak ?? 0);
}

/** 활동이 생겼을 때. */
export const recordActivity = (entry, now) => ({...(entry || {}), activityAt: now, streak: 0});

/** 점검을 시작했을 때. */
export const recordCheck = (entry, now) => ({...(entry || {}), checkAt: now, streak: (entry?.streak ?? 0) + 1});

/** 서비스PM 답이 "할 일 없음"인지. */
export const isNoop = text => String(text || '').trim().replace(/[.\s]+$/, '').toUpperCase() === IDLE_NOOP;

/** 무응답 점검 요청 문구. */
export function idlePrompt(minutes, ownerId) {
  return [
    `[무응답 점검: dev 스레드가 ${minutes}분 넘게 조용해서 릴레이가 실행했다. dev 스레드에서 실행.]`,
    '열린 PR·Issue와 위의 다른 채널 기록을 보고, 막힌 작업이 있으면 가장 급한 Issue 하나를 첫 줄 인계 형식(TASK_READY·REVIEW_CHANGES·QA_READY)으로 Cap에게 넘긴다. Tony 검토 대기가 있으면 먼저 처리한다.',
    `HJ 결정이나 HJ 작업이 필요하면 본문에 <@${ownerId}>를 멘션하고 선택지와 추천안을 쓴다.`,
    `할 일이 없거나(Cap이 작업 중, HJ 대기 등) 이미 넘긴 것을 기다리는 중이면 다른 말 없이 ${IDLE_NOOP} 한 단어만 답한다.`,
  ].join('\n');
}

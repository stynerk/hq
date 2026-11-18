// 프로젝트별 예약 실행. 디스코드·시계를 직접 부르지 않는 순수 함수라 테스트할 수 있다.
// 정의: projects/<slug>.md 프론트매터의 schedules 목록 (hq Issue #15, HJ 지시 2026-11-18).
//   schedules:
//     - id: check-1000
//       at: "10:00"          # KST(UTC+9, 서머타임 없음)
//       prompt: 점검 문구
// 같은 회차는 한 번만 실행한다. 꺼져 있다 켜지면 놓친 회차 중 가장 최근 한 번만 실행한다.
// 처음 보는 예약은 바로 실행하지 않고 다음 회차부터 실행한다(설치·재시작 직후 갑자기 돌지 않게).

export const KST_OFFSET_MINUTES = 9 * 60;
const DAY = 24 * 60 * 60 * 1000;
const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 예약 정의 검사. 잘못된 항목은 errors에 남기고 뺀다. */
export function normalizeSchedules(slug, list) {
  const schedules = [];
  const errors = [];
  if (list === undefined || list === null) return {schedules, errors};
  if (!Array.isArray(list)) return {schedules, errors: [`${slug}: schedules는 목록이어야 한다`]};
  const ids = new Set();
  for (const [i, s] of list.entries()) {
    const id = String(s?.id || '').trim();
    const at = String(s?.at || '').trim();
    const prompt = String(s?.prompt || '').trim();
    if (!id || !timeRe.test(at) || !prompt) { errors.push(`${slug}: schedules[${i}]에 id, at(HH:MM), prompt가 필요하다`); continue; }
    if (ids.has(id)) { errors.push(`${slug}: schedules id ${id}가 겹친다`); continue; }
    ids.add(id);
    schedules.push({id, at, prompt});
  }
  return {schedules, errors};
}

/** now 이전(같은 시각 포함) 가장 최근의 HH:MM(KST) 시각. 반환은 epoch ms. */
export function latestOccurrence(at, now, offsetMinutes = KST_OFFSET_MINUTES) {
  const [, hh, mm] = timeRe.exec(at);
  const offset = offsetMinutes * 60 * 1000;
  const local = new Date(now + offset);
  let occ = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), Number(hh), Number(mm)) - offset;
  if (occ > now) occ -= DAY;
  return occ;
}

export const scheduleKey = (slug, id) => `${slug}|${id}`;

/**
 * 지금 실행할 예약 목록과 새 상태를 돌려준다. 상태는 바꾸지 않는다(호출한 쪽이 저장).
 * @param projects registry.projects (slug, status, channelId, schedules)
 * @param state {runs: {key: 마지막 실행 회차 ms}, paused: {slug: true}}
 * @returns {due: [{project, schedule, key, occurrence}], runs}
 */
export function dueRuns(projects, state, now) {
  const runs = {...(state?.runs || {})};
  const paused = state?.paused || {};
  const due = [];
  for (const project of projects) {
    if (project.status !== 'active' || !project.channelId) continue;
    for (const schedule of project.schedules || []) {
      const key = scheduleKey(project.slug, schedule.id);
      const occurrence = latestOccurrence(schedule.at, now);
      const last = runs[key];
      if (last === undefined) { runs[key] = occurrence; continue; } // 처음 본 예약: 기준점만 잡는다
      if (last >= occurrence) continue; // 이미 실행한 회차
      runs[key] = occurrence; // 놓친 회차가 여럿이어도 가장 최근 한 번만
      if (paused[project.slug]) continue; // 멈춘 동안의 회차는 건너뛴다(재개 뒤 몰아서 돌지 않게)
      due.push({project, schedule, key, occurrence});
    }
  }
  return {due, runs};
}

/** !schedule list 응답 문구. */
export function describeSchedules(project, state, now) {
  const list = project.schedules || [];
  if (!list.length) return `${project.slug}: 등록된 예약이 없습니다.`;
  const paused = !!state?.paused?.[project.slug];
  const fmt = ms => new Date(ms + KST_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ');
  const lines = list.map(s => {
    const last = state?.runs?.[scheduleKey(project.slug, s.id)];
    return `- ${s.at} KST (${s.id}) 마지막 회차: ${last === undefined ? '없음' : fmt(last)}`;
  });
  return [`${project.slug} 예약 ${paused ? '(일시 중지)' : '(동작 중)'}`, ...lines, `지금: ${fmt(now)} KST`].join('\n');
}

// Codex 대화(thread)를 이어 가거나 새로 연다.
// 대화 기록은 계정 폴더(CODEX_HOME) 안에 있으므로, Cap의 계정을 바꾸면 저장된 thread id를 새 계정에서 찾지 못한다
// (2026-11-18 계정 전환 때 "no rollout found"). 이때는 저장된 id를 버리고 새 대화로 시작한다.
// 작업 상태는 GitHub Issue·PR에 있으므로 대화 맥락이 끊겨도 작업은 이어진다.
export const isMissingThread = e => /no rollout found|thread not found/i.test(String(e?.message || e));

/** @returns {Promise<{threadId: string, reset: boolean}>} reset=true면 저장된 대화를 찾지 못해 새로 열었다. */
export async function openThread(rpc, sessions, key, opts, persist = () => {}) {
  const start = async () => {
    const result = await rpc.request('thread/start', opts);
    sessions[key] = result.thread.id; persist();
    return sessions[key];
  };
  if (!sessions[key]) return {threadId: await start(), reset: false};
  try {
    await rpc.request('thread/resume', {threadId: sessions[key], ...opts});
    return {threadId: sessions[key], reset: false};
  } catch (e) {
    if (!isMissingThread(e)) throw e;
    delete sessions[key]; persist();
    return {threadId: await start(), reset: true};
  }
}

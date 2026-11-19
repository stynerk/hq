// 디스코드 연결 감시. PC가 절전에서 깨거나 네트워크가 바뀌면 discord.js가 다시 붙지 못한 채
// 프로세스만 살아 있는 일이 있다(2026-11-19: Tony·Cap 둘 다 06시대 이후 메시지를 받지 못함).
// 이럴 때 프로세스를 끝내면 run.ps1이 10초 뒤 새로 띄운다.
//  - 타이머가 오래 멈췄다 다시 돌면(절전 복귀) 바로 재시작
//  - 디스코드가 준비 상태가 아닌 채로 일정 시간이 지나면 재시작
export function startWatchdog({isReady, exit, now = Date.now, every = 60_000, maxNotReady = 5 * 60_000, maxGap = 3 * 60_000, log = console.error, setIntervalFn = setInterval, clearIntervalFn = clearInterval}) {
  let last = now(); let notReadySince = null; let done = false;
  const fire = reason => { if (done) return; done = true; log(`watchdog: ${reason} — 재시작합니다.`); exit(); };
  const tick = () => {
    const t = now(); const gap = t - last; last = t;
    if (gap > maxGap) return fire(`${Math.round(gap / 1000)}초 동안 멈췄다 다시 깨어남(절전 복귀 등)`);
    if (isReady()) { notReadySince = null; return; }
    notReadySince ??= t;
    if (t - notReadySince >= maxNotReady) fire(`디스코드 연결이 ${Math.round((t - notReadySince) / 60000)}분 넘게 끊김`);
  };
  const handle = setIntervalFn(tick, every);
  return {tick, stop: () => clearIntervalFn(handle)};
}

// discord.js Client가 실제로 연결돼 있는지. ws.status 0 = READY.
export const discordReady = client => !!client && client.isReady?.() === true && (client.ws?.status ?? 0) === 0;

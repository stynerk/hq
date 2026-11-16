export function botIdentityInstructions(reg, self) {
  if (!reg.claudeBotId || !reg.codexBotId) throw new Error('레지스트리 봇 ID가 없어 인계를 구성할 수 없습니다.');
  const claude = `<@${reg.claudeBotId}>`, codex = `<@${reg.codexBotId}>`;
  const mine = self === 'claude' ? claude : codex;
  const peer = self === 'claude' ? codex : claude;
  const example = self === 'claude' ? `${peer} TASK_READY #번호` : `${peer} REVIEW_REQUEST #번호`;
  return `현재 hq 레지스트리의 디스코드 연결: 서비스PM(Claude 릴레이) ${claude}, 개발PM(Codex 브릿지) ${codex}. 너의 멘션은 ${mine}, 상대의 멘션은 ${peer}이다. 인계 첫 줄은 "${example}" 형식으로 쓰며 등록된 dev 스레드에서만 보낸다. 프로젝트 문서의 전환 기간에 적힌 옛 PM_Sora ID 대신 이 연결을 사용한다.`;
}

---
guild_id: "1563042660044775486"
owner:
  name: HJ
  user_id: "565583270448988163"
bots:
  claude_relay:
    name: Tony
    user_id: "1563042220230053928"
    verified: true
    role: CPO Tony. #hq 총괄과 모든 프로젝트의 서비스PM (옛 이름 HJ Company, 2026-11-17 변경)
  codex_bridge:
    name: Cap
    user_id: "1563059804082282516"
    verified: true
    role: CTO Cap. 모든 프로젝트의 개발PM (옛 이름 Codex_bot, 2026-11-17 변경)
  retiring:
    - name: PM_Sora
      user_id: "1570101648054034522"
      verified: true
      note: onemorestep 제출(11-25) 후 Claude 릴레이로 통합하고 정리
roles:
  service_pm: "1570103275280138252"  # 디스코드 "서비스PM" 역할. PM_Sora → Tony 이전은 HJ가 디스코드에서 한다(2026-11-17)
channels:
  hq: "1571771762578825298"
  hq_alerts: "1571771764462321744"
categories:
  hq: "1571771756908253295"
  projects: "1571771758778777731"
  archive: "1571771760662151168"
project_channels:
  onemorestep:
    channel_id: "1570085138774233170"
    dev_thread_id: "1571771769461809153"
---

# 디스코드 ID

서버, 사람, 봇의 ID는 여기에만 적는다. 다른 문서와 에이전트는 이 파일을 읽는다. 채팅 기록을 보고 ID를 추정하지 않는다(LEARNINGS 2026-11-12: 소라가 자기 ID를 Cap의 것으로 착각).

프로젝트 채널 ID는 [projects/](../projects/)의 각 파일에 있다.

## 확인 상태

- `verified: true`는 저장소 문서나 봇 설정에서 이름과 ID가 함께 확인된 값이다.
- HJ Company의 ID는 Codex 브릿지 설정의 신뢰 봇 목록에 있는 값이다. 이름과 함께 확인하지는 못했다. 3단계에서 릴레이를 띄울 때 봇 자신의 ID로 확인하고 `verified: true`로 바꾼다.
- HQ 채널과 카테고리 ID는 3단계에서 봇이 만들면서 채운다.

## 지금 서버에 있는 것으로 확인된 채널 (2026-11-16)

Codex 브릿지의 대화 기록에 남은 채널 ID다. 이름은 확인하지 못했다. 재구성할 때 ARCHIVE로 옮길 후보다.

| 채널 ID | 확인된 사실 |
|---|---|
| 1570085138774233170 | #onemorestep (저장소 CLAUDE.md에 명시) |
| 1563061495645081630 | Codex 브릿지가 OurAdventure 작업 폴더와 Business 계정에 연결한 채널 |
| 1563061555464114296 | Codex 대화 기록만 있음 |
| 1565653707159240804 | Codex 대화 기록만 있음 |
| 1563042660615462914 | Codex 대화 기록만 있음 |

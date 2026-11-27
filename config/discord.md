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
    role: CPO Tony.
  codex_bridge:
    name: Cap
    user_id: "1563059804082282516"
    verified: true
    role: CTO Cap. 모든 프로젝트의 개발PM (옛 이름 Codex_bot, 2026-11-17 변경)
  thanos:
    name: Thanos
    user_id: "1575614378927980544"
    verified: true
    role: CBO/CMO Thanos.
  retiring:
    - name: PM_Sora
      user_id: "1570101648054034522"
      verified: true
      note: onemorestep 제출(11-25) 후 Claude 릴레이로 통합하고 정리
channels:
  hq: "1571771762578825298"
  hq_alerts: "1571771764462321744"
  thanos: "1575616902363881522"
categories:
  hq: "1571771756908253295"
  projects: "1571771758778777731"
  archive: "1571771760662151168"
project_channels:
  onemorestep:
    channel_id: "1570085138774233170"
    dev_thread_id: "1571771769461809153"
    github_notifications: dev_thread
  our-adventure:
    channel_id: "1572005322837725184"
    dev_thread_id: "1572005326054629397"
  hq:
    channel_id: "1571771762578825298"
    dev_thread_id: "1575342610414051460"
---

# 디스코드 ID

서버, 사람, 봇의 ID는 여기에만 적는다. 다른 문서와 에이전트는 이 파일을 읽는다. 채팅 기록을 보고 ID를 추정하지 않는다(LEARNINGS 2026-11-12: 소라가 자기 ID를 Cap의 것으로 착각).

프로젝트 채널 ID는 [projects/](../projects/)의 각 파일에 있다.

Thanos는 등록된 `#thanos`, `#hq`, 활성 프로젝트 본문에서 HJ 또는 Tony의 직접 멘션에만 답한다.

## 확인 상태

- `verified: true`는 저장소 문서나 봇 설정에서 이름과 ID가 함께 확인된 값이다.
- HJ Company의 ID는 Codex 브릿지 설정의 신뢰 봇 목록에 있는 값이다. 이름과 함께 확인하지는 못했다. 3단계에서 릴레이를 띄울 때 봇 자신의 ID로 확인하고 `verified: true`로 바꾼다.
- HQ 채널과 카테고리 ID는 3단계에서 봇이 만들면서 채운다.

## GitHub 알림

- onemorestep `github_notifications: dev_thread`: 2026-11-19 웹후크를 새로 만들고 `?thread_id`로 dev 스레드에 올린다. 웹후크 주소는 비밀이라 기록하지 않는다.
- 프론트매터의 주석은 봇이 레지스트리를 다시 쓸 때 지워지므로, 설명은 이 본문에 적는다.

## 지금 서버에 있는 것으로 확인된 채널 (2026-11-16)

Codex 브릿지의 대화 기록에 남은 채널 ID다. 이름은 확인하지 못했다. 재구성할 때 ARCHIVE로 옮길 후보다.

| 채널 ID | 확인된 사실 |
|---|---|
| 1570085138774233170 | #onemorestep (저장소 CLAUDE.md에 명시) |
| 1563061495645081630 | Codex 브릿지가 OurAdventure 작업 폴더와 Business 계정에 연결한 채널 |
| 1563061555464114296 | Codex 대화 기록만 있음 |
| 1565653707159240804 | Codex 대화 기록만 있음 |
| 1563042660615462914 | Codex 대화 기록만 있음 |

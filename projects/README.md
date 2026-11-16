# 프로젝트 레지스트리

프로젝트 하나에 파일 하나. 디스코드 릴레이와 Codex 브릿지는 이 폴더를 읽어 채널마다 어떤 프로젝트, 어떤 작업 폴더, 어떤 페르소나로 답할지 정한다. 그래서 프론트매터는 정확해야 한다. 값을 모르면 `null`로 두고 추정하지 않는다.

## 목록

| slug | 이름 | 상태 | 저장소 |
|---|---|---|---|
| [onemorestep](onemorestep.md) | onemorestep (미리내) | active | stynerk/onemorestep |
| [our-adventure](our-adventure.md) | Our Adventure | paused | stynerk/OurAdventure |

`status`: `active`(에이전트가 스스로 일한다), `paused`(HJ가 부를 때만 답한다), `archived`(답하지 않는다).

## 형식

```markdown
---
slug: example                       # 파일 이름과 같게
title: 사람이 부르는 이름
status: active                      # active | paused | archived
repo: owner/repo
local_path: C:/Users/styne/orca/projects/example
discord:
  channel_id: "123"                 # 따옴표로. 숫자로 쓰면 큰 수가 깨진다
  dev_thread_id: null
agents:
  service_pm:
    name: 서비스PM                   # 페르소나 이름. 미정이면 역할 이름
    persona: null                   # 기본 페르소나와 다른 점만 한두 줄
  dev_pm:
    name: 개발PM
    persona: null
gates:                              # HJ 사전 승인이 필요한 관문
  - name: 컨셉 확정
    due: null
    status: open                    # open | passed
---

# 이름

한 줄 정의. 누구의 어떤 문제를 푸는가.

## 목표와 성공 지표
## 이 프로젝트만의 규칙
## 문서 지도
## 구조 전환 상태
```

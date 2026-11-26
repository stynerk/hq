---
slug: hq
title: hq (규칙 정본·봇)
status: active
repo: stynerk/hq
local_path: C:/Users/styne/orca/hq
lead_role: hq-lead
discord:
  channel_id: null
  dev_thread_id: null
agents:
  service_pm:
    name: Tony
    persona: null
  dev_pm:
    name: Cap
    persona: null
gates: []
---

# hq

모든 프로젝트의 규칙 정본(playbooks, agents, 레지스트리)과 디스코드 봇(`bots/`)의 저장소. 제품 프로젝트가 아니라, 봇·운영 개선을 Issue로 Cap에게 넘기기 위해 등록했다(2026-11-26 HJ 결정, hq Issue #27 계기).

## 채널

- 채널은 #hq 자체다. #hq 본문은 지금처럼 총괄(기본)과 Cap(불렀을 때, 읽기 전용)이 답한다.
- #hq 아래 `dev` 스레드만 프로젝트 dev 스레드로 동작한다: Claude 쪽은 총괄(`lead_role: hq-lead`), Codex 쪽은 개발PM. 인계는 다른 프로젝트와 같이 `TASK_READY #번호` 등 실행 키워드로 한다.
- dev 스레드는 HJ가 #hq에서 `!project new hq stynerk/hq`로 만든다. 릴레이가 #hq 아래에 `dev` 스레드를 만들고 `config/discord.md`에 기록한다.

## 이 프로젝트만의 규칙

- 규칙(playbooks, agents) 변경은 HJ 확정 뒤에만 병합한다. `bots/` 코드는 브랜치와 PR로 하고, 병합과 봇 재시작·운영 호스트 전환은 HJ가 한다.
- 전체 상태 보고에서 hq는 제품 프로젝트와 따로 한 줄로 쓴다.

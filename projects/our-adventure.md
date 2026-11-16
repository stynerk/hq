---
slug: our-adventure
title: Our Adventure
status: active
repo: stynerk/OurAdventure
local_path: C:/Users/styne/orca/OurAdventure
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
gates:
  - name: PRD v2 범위 승인
    due: 2026-10-26
    status: passed
  - name: Blaze 요금제 전환과 예산 알림
    due: null
    status: open
  - name: MVP 공개
    due: null
    status: open
---

# Our Adventure

여행지에서 그룹이 함께 장소마다 사진으로 스탬프를 모으고, 여행 후 결과 이미지로 남기는 탐험형 모바일 여행 기록 서비스. 1차 대상은 아이 동반 가족, 범위는 국내 장거리 여행.

## 목표와 성공 지표

- 현재 제품 기준은 저장소 `docs/PRD_V2.md`(2단계 정리 후 `docs/product/PRD.md`).
- 성공 지표는 아직 PRD v2에 숫자로 정해져 있지 않다. 재개할 때 서비스PM의 첫 작업이다.

## 이 프로젝트만의 규칙

- 기존 경주 프로토타입(루트 `index.html`, GitHub Pages)과 로컬 저장 키는 보존한다.
- Firebase 요금제 전환, 유료 AI·지도 API 호출은 HJ 승인 사항이다(`owner-decision`).
- `main`에 루트 `index.html`이나 `.github/workflows/pages.yml`을 바꾸는 병합은 GitHub Pages 배포를 일으킨다(로컬 `pages.yml` 기준, 2026-11-16 확인). 이런 PR은 `release-ready`로 두고 HJ가 병합한다. 다른 파일만 바꾸는 병합은 PM 합의로 한다.
- 공개 사이트 버그는 수정 후 Pages 배포 성공까지 확인한다.

## 문서 지도 (2단계 정리 후)

| 무엇 | 위치 |
|---|---|
| 제품 | `docs/product/` (PRD, AI 코스 가이드) |
| QA | `docs/qa/` (QA 체크리스트 v2) |
| 기술 | `docs/tech/` (Firebase 설정, T0 스파이크 검토, 경주 AI 핸드오버) |
| 참조 자료 | `docs/reference/` (경주 일정) |
| 지난 기준 문서 | `docs/archive/` (Phase 1 계열, 이전 인수인계) |
| 결정, 인수인계, 시행착오 | `docs/team/` |

## 구조 전환 상태

2026-11-17 HJ 결정: 봇이 동작하도록 `active`로 바꾸고 표준 구조로 전환한다. 이번에는 구조 전환만 하고, 기획·개발 재개(성공 지표 정의 등)는 onemorestep 제출(11-25) 뒤 HJ가 정한다. Tony·Cap은 그 전까지 제품 작업을 시작하지 않는다.

- 실행: Tony가 #hq에서 `!project new our-adventure stynerk/OurAdventure`로 새 채널 `#our-adventure`와 dev 스레드를 연다. 예전 `#ouradventure`(ARCHIVE)는 기록으로 둔다. 저장소·PC 정리는 Issue로 Cap이 한다.

- 이름은 전 프로젝트 공통 Tony(CPO)·Cap(CTO)이다(2026-11-17).
- 로컬 폴더가 `main`이 아닌 `docs/prd-v2-group-stamp-tour` 브랜치에 멈춰 있다(2026-11-16 확인). 개발PM이 미커밋 변경을 `backup/` 브랜치에 커밋한 뒤 `main`으로 전환한다(HJ 승인).

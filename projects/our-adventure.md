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
  - name: 개요 확정 (docs/product/OVERVIEW.md, 재개 첫 관문)
    due: null
    status: open
  - name: 첫 화면 HJ 확인 (화면이 처음 동작하면 바로)
    due: null
    status: open
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

- 현재 제품 기준은 저장소 `docs/product/PRD.md`(PRD v2).
- 성공 지표는 아직 숫자로 정해져 있지 않다. 재개 첫 관문인 개요(`docs/product/OVERVIEW.md`)에서 정한다.

## 재개 (2026-11-26 HJ)

HJ가 onemorestep 제출 후 재개를 정했다. 순서: ① 총괄이 에이전트 구성 확정(hq PR #26, HJ 확정) ② Tony가 개요 작성 — 배경·목적, 대상 한 사람, 목표 밸류, 성공 지표, 리소스, 죽는 전제 ③ 관문 재설정 후 남은 T Issue(#36, #37, #40, #41, #44, #47, #48) 우선순위를 정해 Cap에게 인계. 개요 관문 통과 전에는 `ready` Issue를 만들지 않는다.

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

완료(Issue #33~#35, PR #32 병합). 아래는 기록이다.

2026-11-17 HJ 결정: 봇이 동작하도록 `active`로 바꾸고 표준 구조로 전환한다. 이번에는 구조 전환만 하고, 기획·개발 재개(성공 지표 정의 등)는 onemorestep 제출(11-25) 뒤 HJ가 정한다. Tony·Cap은 그 전까지 제품 작업을 시작하지 않는다.

- 실행: Tony가 #hq에서 `!project new our-adventure stynerk/OurAdventure`로 새 채널 `#our-adventure`와 dev 스레드를 연다. 예전 `#ouradventure`(ARCHIVE)는 기록으로 둔다. 저장소·PC 정리는 Issue로 Cap이 한다.

- 이름은 전 프로젝트 공통 Tony(CPO)·Cap(CTO)이다(2026-11-17).
- 로컬 폴더가 `main`이 아닌 `docs/prd-v2-group-stamp-tour` 브랜치에 멈춰 있다(2026-11-16 확인). 개발PM이 미커밋 변경을 `backup/` 브랜치에 커밋한 뒤 `main`으로 전환한다(HJ 승인).

## 재개 시 검토 후보

- A2UI(a2ui.org, 에이전트가 JSON으로 화면 구성을 보내고 앱이 등록된 컴포넌트로만 그리는 생성형 UI 표준): 코스 결과 화면(일정 카드, 지도, 예약, 대안 비교)에 쓸지 Tony가 기획 검토 때 판단한다. v1.0 성숙도와 React 렌더러 품질은 researcher로 확인(2026-11-24 HJ).

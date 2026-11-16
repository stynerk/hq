---
slug: onemorestep
title: onemorestep (미리내)
status: active
repo: stynerk/onemorestep
local_path: C:/Users/styne/orca/onemorestep
discord:
  channel_id: "1570085138774233170"
  dev_thread_id: null
agents:
  service_pm:
    name: 소라
    persona: 기본 페르소나와 같다. 대회 배점(문제 정의 30, 완성도 30, Liner API 활용 20, 확장성과 임팩트 20)으로 모든 산출물을 설명한다.
  dev_pm:
    name: Cap
    persona: 기본 페르소나와 같다. 시연 안정성을 최우선으로 본다.
gates:
  - name: 컨셉 확정
    due: 2026-11-11
    status: passed
  - name: 데모 시나리오 확정
    due: null
    status: open
  - name: 최종 제출
    due: 2026-11-25T23:59+09:00
    status: open
---

# onemorestep (미리내)

제1회 라이너 해커톤 .EXE-THON 출품작. 미리내는 초기 창업자 곁에서 먼저 챙겨 주는 프로액티브 업무 에이전트다. 회사 모델에 비춰 지원사업, 시장 변화, 단계별로 챙길 일을 찾아 "지금 할 일"로 바꿔 준다.

## 목표와 성공 지표

- 대회 배점 80점 이상(리뷰어 기준), 결선 진출(11-27 발표).
- 상세: 저장소 `docs/product/PLAN.md`, `docs/product/MVP.md`, `docs/team/SUBMISSION.md`.

## 이 프로젝트만의 규칙

- 개발 기간은 2026-11-12부터 11-25까지. 제품 코드는 이 기간에 새로 쓴다. 기존 프로젝트 코드를 가져오지 않는다.
- Liner API가 핵심 기능에 쓰여야 한다(대회 조건).
- 사내 문서, 고객 정보, 내부 수치를 쓰지 않는다. 가상 데이터나 공개 데이터만.
- 대회 신청, 제출, 주최 측 연락, 저장소 공개 전환은 HJ가 한다.
- 리뷰어(심사위원)는 Gemini로 전환을 검토 중이다(데모 시나리오 관문 전).

## 문서 지도

| 무엇 | 위치 |
|---|---|
| 기획 | `docs/product/` (PLAN, MVP, AGENT, PERSONAS, INTERVIEW) |
| 기술 | `docs/tech/` (ARCHITECTURE, API_PROVIDERS, LINER_API) |
| 결정, 인수인계, 시행착오 | `docs/team/` |
| 대회 요강과 제출 체크리스트 | `docs/team/SUBMISSION.md` |

## 구조 전환 상태

2026-11-16 HJ 결정으로 Our Adventure보다 먼저, 제출 전에 전면 전환한다(기획 단계에서 멈춰 있어 위험이 낮다).

- [x] 저장소 문서 전환 (onemorestep `1e6f629`): `CLAUDE.md`·`AGENTS.md`를 hq 기준으로, `HANDOFF_CTO.md` → `HANDOFF_DEV.md`, `HANDOFF_SERVICE.md` 신설, `ROLE_PM.md`·`WORKFLOW.md`는 `docs/archive/`, `DECISIONS.md` 정본화, 공통 LEARNINGS를 hq로
- [ ] `qa`, `release-ready` 라벨 생성 (Cap)
- [ ] 열린 브랜치 정리: `issue-7-web-mockup`, `issue-9-api-providers`, `design-main-home-wireframes` (새 main에 충돌 없이 병합되는 것 확인함)
- [ ] 새 봇 전환: Claude 릴레이(소라), Codex 브릿지 레지스트리화(Cap), dev 스레드 생성. 전환되면 `CLAUDE.md`·`AGENTS.md`의 "전환 기간" 절을 지운다
- [ ] PC 본 폴더를 `main`으로 두고 역할별 작업 트리로 분리 (지금 본 폴더는 Cap의 `issue-9-api-providers` 브랜치)

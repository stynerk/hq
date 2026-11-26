# hq

HJ의 모든 프로젝트가 공유하는 에이전트 운영 저장소다. 에이전트가 읽고 따르는 규칙, 에이전트 정의, 프로젝트 목록, 새 프로젝트 템플릿이 여기 있다.

**문서 기록의 정본은 Git이다.** 에이전트 운영에 관한 문서는 모두 이 저장소나 각 프로젝트 저장소의 Markdown 파일로 둔다. 구글 드라이브의 `해커톤/해커톤 출전팀` 폴더와 팀 로그 시트는 2026-11-16부로 보관용이다. 드라이브에는 대회 제출물과 바이너리 파일만 둔다.

## 구조

```
hq/
├ README.md            이 문서
├ CLAUDE.md, AGENTS.md 이 저장소에서 일하는 에이전트의 규칙
├ DECISIONS.md         HJ가 확정한 운영 결정 (프로젝트 공통)
├ LEARNINGS.md         프로젝트 공통 시행착오
├ METRICS.md           HJ 검수 부담 지표
├ MIGRATION.md         드라이브·저장소 문서 이전 현황
├ playbooks/           모든 에이전트가 따르는 규칙
│  ├ operating-principles.md   목적, 대기 금지, 검수 패키지, 피드백 규칙화
│  ├ decision-rights.md        누가 무엇을 결정하는가
│  ├ workflow.md               Issue·PR·QA·릴리즈 흐름
│  ├ session.md                세션 시작과 종료 루틴
│  ├ discord.md                채널 구조와 응답 규칙
│  └ new-project.md            새 프로젝트를 여는 절차
├ agents/              에이전트 정의 (대표 3, 서브 5)
├ projects/            프로젝트 레지스트리 (프로젝트당 md 하나)
├ config/              디스코드 서버·봇·사람 ID
├ templates/project/   새 프로젝트 저장소에 까는 파일
└ docs/history/        지난 설계 문서
```

## 팀 구조

```
HJ (오너)
└ 총괄 hq-lead ─────────── #hq
   └ 프로젝트마다
      ├ 서비스PM service-pm ─ #<프로젝트>       HJ와 기획·방향
      │  ├ Jarvis  researcher   조사·API 지도·경쟁
      │  ├ Thanos  business     사업 모델·가격·시장
      │  ├ Loki    challenger   반대 심문 (Gemini)
      │  ├ Fury    reviewer     심사위원 패널 3인 (Gemini)
      │  └ Friday  editor       30초 문장·용어·수치 표기
      └ 개발PM dev-pm ─────── #<프로젝트> › dev  개발·QA·릴리즈
         ├ implementer          구현
         ├ qa                   테스트·QA·시연 대본
         └ release              릴리즈 준비
```

대표 에이전트(총괄, 서비스PM, 개발PM)는 디스코드에서 사람과 대화하고 서브에이전트에게 일을 나눠 준다. 서브에이전트는 사람과 직접 대화하지 않고 결과를 자기 대표에게만 돌려준다. 자세한 형식은 [agents/README.md](agents/README.md).

## 처음 읽을 것

| 나는 | 읽는 순서 |
|---|---|
| HJ | 이 문서 → [DECISIONS.md](DECISIONS.md) → [playbooks/decision-rights.md](playbooks/decision-rights.md) |
| 에이전트 | [playbooks/session.md](playbooks/session.md)의 순서를 따른다 |
| 새 프로젝트를 여는 총괄 | [playbooks/new-project.md](playbooks/new-project.md) |

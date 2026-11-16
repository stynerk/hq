# AGENTS.md — {{title}}

이 저장소에서 코드를 다루는 Codex 에이전트는 **개발PM {{dev_pm_name}}**이거나 그가 부른 서브에이전트다. 기획과 범위는 서비스PM {{service_pm_name}}(Claude)의 일이며 `CLAUDE.md`를 따른다.

## 먼저 읽을 것

역할과 공통 규칙의 정본은 hq 저장소(stynerk/hq)에 있다. PC에서는 `C:/Users/styne/orca/hq`.

1. hq `playbooks/session.md`의 시작 순서를 따른다.
2. 역할: 개발PM은 hq `agents/dev-pm.md`. 서브에이전트는 `.codex/agents/`의 자기 정의.
3. 이 프로젝트: hq `projects/{{slug}}.md`
4. 이 저장소: `docs/team/HANDOFF_DEV.md`, `docs/team/LEARNINGS.md`, `docs/team/DECISIONS.md`
5. `ready`, `changes-requested`, `qa` 라벨이 붙은 Issue

## 서브에이전트

개발PM은 `.codex/agents/`의 implementer, qa, release에게 일을 나눠 맡긴다. hq `agents/`에서 내보낸 사본이므로 여기서 고치지 않는다.

## 이 저장소에서 지킬 것

- `main`에 직접 커밋하지 않는다(문서만 바꾸는 경우는 예외).
- Issue마다 작업 트리 `.worktrees/issue-번호`와 브랜치 `issue-번호-짧은-설명`.
- PR 본문에 다섯 줄 보고: 된 것, 안 된 것, 위험, 서비스PM이 정해야 할 것, 다음 작업.
- 병합은 서비스PM 승인과 QA 통과가 모두 있을 때. 배포는 HJ.
- 비밀값을 코드, 문서, Issue, PR에 적지 않는다. `.env`는 커밋하지 않는다.
- 세션을 끝낼 때 `docs/team/HANDOFF_DEV.md`를 통째로 새로 쓴다.

## 실행과 검증

(이 프로젝트의 설치, 실행, 테스트 명령을 적는다.)

## 이 프로젝트만의 차이

(hq 규칙과 다른 점만 적는다. 없으면 비워 둔다.)

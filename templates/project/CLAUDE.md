# CLAUDE.md — {{title}}

이 저장소에서 Claude는 **서비스PM {{service_pm_name}}**으로 일한다. 코드 구현은 개발PM {{dev_pm_name}}(Codex)의 일이며 `AGENTS.md`를 따른다.

## 먼저 읽을 것

역할과 공통 규칙의 정본은 hq 저장소(stynerk/hq)에 있다. PC에서는 `C:/Users/styne/orca/hq`.

1. hq `playbooks/session.md`의 시작 순서를 따른다.
2. 역할: hq `agents/service-pm.md`
3. 이 프로젝트: hq `projects/{{slug}}.md`
4. 이 저장소: `docs/team/DECISIONS.md`, `docs/team/LEARNINGS.md`, `docs/team/HANDOFF_SERVICE.md`, `docs/team/HANDOFF_DEV.md`

## 서브에이전트

`.claude/agents/`의 researcher(Jarvis), challenger(Loki), reviewer(Fury), editor(Friday)를 쓴다. hq `agents/`에서 내보낸 사본이므로 여기서 고치지 않는다.

## 이 저장소에서 지킬 것

- 문서는 `.worktrees/service` 작업 트리에서 고친다. 커밋 전에 브랜치를 확인한다.
- 개발 작업은 Issue로만 넘긴다. 디스코드 메시지로 구현을 맡기지 않는다.
- HJ가 확정한 결정은 그날 `docs/team/DECISIONS.md`에 커밋한다.
- 디스코드 ID는 hq `config/discord.md`와 hq `projects/{{slug}}.md`의 값만 쓴다.

## 이 프로젝트만의 차이

(hq 규칙과 다른 점만 적는다. 없으면 비워 둔다.)

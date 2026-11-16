# AGENTS.md — hq

이 저장소는 모든 프로젝트의 에이전트 운영 규칙 정본이다. Codex가 여기서 하는 일은 `bots/` 아래의 봇 코드(3단계부터)뿐이다.

- 규칙 문서(`playbooks/`, `agents/`, `DECISIONS.md`)는 고치지 않는다. 고칠 필요가 있으면 총괄에게 근거와 수정안을 알린다.
- `projects/`의 레지스트리는 읽기만 한다. 봇은 이 폴더의 프론트매터로 채널 → 작업 폴더·페르소나를 정한다.
- `bots/` 변경은 브랜치와 PR로 한다. 토큰과 `private/` 설정은 커밋하지 않는다.
- 공통 규칙은 [playbooks/](playbooks/)를, 개발PM 역할은 [agents/dev-pm.md](agents/dev-pm.md)를 따른다.

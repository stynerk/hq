# 세션 시작과 종료

세션을 시작하면 작업 전에 아래를 읽는다. 끝내기 전에 아래를 갱신한다. 갱신하지 않은 세션은 끝난 것으로 보지 않는다.

## 시작할 때 읽는 순서

모든 대표 에이전트:

1. hq의 [operating-principles.md](operating-principles.md), [decision-rights.md](decision-rights.md)
2. 자기 정의 파일 ([agents/](../agents/))
3. hq의 [LEARNINGS.md](../LEARNINGS.md)와 [DECISIONS.md](../DECISIONS.md)

프로젝트 일을 하는 서비스PM, 개발PM은 이어서:

4. [projects/<slug>.md](../projects/): 프로젝트 목표, 관문, 페르소나, 고유 규칙
5. 프로젝트 저장소의 `docs/team/DECISIONS.md`, `docs/team/LEARNINGS.md`
6. 자기 인수인계(`HANDOFF_SERVICE.md` 또는 `HANDOFF_DEV.md`)와 상대의 인수인계
7. 열린 Issue와 PR. 개발PM은 `ready`, `changes-requested`, `qa` 라벨부터

총괄은 이어서:

4. [projects/README.md](../projects/README.md)의 프로젝트 목록과 각 프로젝트의 `status`
5. #hq의 지난 대화 중 처리하지 않은 요청

## HJ에게 첫 보고

서비스PM은 세션을 시작하거나 HJ가 상태를 물으면 세 줄로 답한다: 지금 상태, 열린 결정, 오늘 할 일. 총괄은 프로젝트마다 한 줄씩.

## 끝낼 때 갱신하는 것

| 무엇 | 서비스PM | 개발PM | 총괄 |
|---|---|---|---|
| 자기 인수인계를 통째로 새로 쓰기 | `HANDOFF_SERVICE.md` | `HANDOFF_DEV.md` | 해당 없음 |
| 확정된 결정 한 줄씩 추가 | 프로젝트 `DECISIONS.md` | 기술 결정은 PR에 한 줄 | `hq/DECISIONS.md` |
| 틀렸거나 되돌린 일 | 프로젝트 `LEARNINGS.md`, 공통이면 hq | 같음 | `hq/LEARNINGS.md` |
| HJ 피드백 | [METRICS.md](../METRICS.md)에 한 행 | 같음 | 같음 |
| Issue 상태 | 라벨 갱신 | 라벨 갱신 | 해당 없음 |

hq 파일을 고치는 것은 문서 변경이므로 `main`에 바로 커밋해도 된다. 커밋 메시지에 어느 프로젝트에서 무엇 때문에 고쳤는지 쓴다.

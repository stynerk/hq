# 작업 흐름

모든 프로젝트가 같은 흐름을 쓴다. 프로젝트마다 다른 점은 그 프로젝트의 `docs/team/` 문서에 차이만 적는다.

## 1. 어디에 무엇을 두나

| 무엇 | 어디 |
|---|---|
| 개발 작업 | GitHub Issue (원장) |
| HJ의 판단이 필요한 것 | `owner-decision` 라벨 Issue |
| 확정된 결정 | `docs/team/DECISIONS.md` (공통이면 hq/DECISIONS.md) |
| 지금 상태와 다음 할 일 | `docs/team/HANDOFF_SERVICE.md`, `docs/team/HANDOFF_DEV.md` |
| 시행착오 | `docs/team/LEARNINGS.md` (공통이면 hq/LEARNINGS.md) |
| 대화, 질문, 알림 | 디스코드 ([discord.md](discord.md)) |

## 2. Issue 라벨

한 Issue에는 상태 라벨을 하나만 둔다. 상태를 바꾸는 쪽이 라벨도 바꾼다.

| 라벨 | 뜻 | 다음에 움직이는 쪽 |
|---|---|---|
| `ready` | 서비스PM이 작업 지시를 다 썼다 | 개발PM |
| `in-progress` | 개발PM(구현 서브에이전트)이 작업 중이다 | 개발PM |
| `review` | PR이 열렸고 서비스PM의 검토를 기다린다 | 서비스PM |
| `changes-requested` | 서비스PM이 수정을 요청했다 | 개발PM |
| `qa` | 서비스PM이 승인했고 QA를 기다린다 | 개발PM(QA 서브에이전트) |
| `release-ready` | QA를 통과해 병합됐고 배포를 기다린다 | HJ (배포가 필요한 경우만) |
| `owner-decision` | HJ의 선택이 필요하다. 선택지와 추천안이 적혀 있다 | HJ |

## 3. 흐름

1. **지시**: 서비스PM이 Issue 템플릿(목적, 사용자 시나리오, 완료 조건, 제외 범위, 기한)을 채우고 `ready`를 붙인다. dev 스레드에 `TASK_READY #번호`로 알린다.
2. **구현**: 개발PM이 `in-progress`로 바꾸고 구현 서브에이전트에 맡긴다. 브랜치는 `issue-번호-짧은-설명`, 작업 트리는 Issue마다 따로 만든다.
3. **PR**: 구현이 끝나면 개발PM이 완료 조건을 직접 돌려 확인하고 PR을 연다. PR 본문에 다섯 줄 보고(된 것, 안 된 것, 위험, 서비스PM이 정해야 할 것, 다음 작업)를 쓰고 `review`로 바꾼다.
4. **검토**: 서비스PM이 완료 조건 기준으로 검토한다. 구현 방법은 지정하지 않는다. 고칠 것이 있으면 적고 `changes-requested`, dev 스레드에 `REVIEW_CHANGES #번호`. 통과면 승인하고 `qa`.
5. **수정**: 같은 브랜치, 같은 PR에서 고친다. 새 Issue나 새 PR을 만들지 않는다.
6. **QA**: 개발PM이 QA 서브에이전트에 맡긴다. 프로젝트의 QA 체크리스트와 완료 조건을 실제로 돌린다. 실패하면 `changes-requested`로 되돌리고 실패 항목을 적는다.
7. **병합**: 서비스PM 승인과 QA 통과가 모두 있으면 개발PM이 `main`에 병합한다. HJ를 기다리지 않는다. 단 `main` 병합이 곧 배포·비용·공개로 이어지는 저장소는 `release-ready`로 두고 병합을 HJ에게 넘긴다([decision-rights.md](decision-rights.md) 2절).
8. **릴리즈**: 배포가 필요한 변경이면 개발PM이 릴리즈 서브에이전트로 노트와 배포 체크리스트를 만들고 `release-ready`로 둔다. 배포는 HJ가 한다. 배포가 필요 없으면 Issue를 닫는다.

## 4. 규칙

- `main`에 직접 커밋하지 않는다. 문서만 바꾸는 경우는 예외다.
- PR 하나는 Issue 하나만 다룬다. 하루 안에 끝나지 않는 Issue는 서비스PM에게 나눠 달라고 한다.
- 같은 Issue를 두 세션이 동시에 잡지 않는다. `in-progress`가 붙어 있으면 다른 Issue를 고른다.
- 범위 밖의 개선은 하지 않고 새 Issue로 올린다. 우선순위는 서비스PM이 정한다.
- 병합 직전에 원격 상태를 다시 확인한다. 이미 병합됐으면 최신 `main`을 기준으로 후속 작업을 정리한다.

## 5. 작업 폴더

에이전트끼리 같은 체크아웃을 쓰지 않는다. 같은 폴더를 쓰다 다른 브랜치에 커밋한 사고가 있었다(LEARNINGS 2026-11-12).

| 누가 | 어디서 |
|---|---|
| 프로젝트 본 폴더 | 항상 `main`. 직접 작업하지 않고 `git pull`과 작업 트리 생성에만 쓴다 |
| 서비스PM | 문서 전용 작업 트리 `<프로젝트>/.worktrees/service` |
| 개발PM의 서브에이전트 | Issue마다 작업 트리 `<프로젝트>/.worktrees/issue-번호` |

커밋하기 전에 현재 브랜치를 확인한다. 병합된 작업 트리는 개발PM이 정리한다(`git worktree remove`).

## 6. 인수인계

- `HANDOFF_SERVICE.md`(서비스PM)와 `HANDOFF_DEV.md`(개발PM)는 세션을 끝낼 때마다 **통째로 새로 쓴다**. 이전 내용은 git 이력에 남는다.
- 형식: 지금 상태, 검증한 것과 못 한 것, 열린 결정, 다음 할 일(우선순위 순), 상대에게 전할 말.
- 상대 역할의 인수인계는 세션을 시작할 때 읽기만 한다. 고치지 않는다.

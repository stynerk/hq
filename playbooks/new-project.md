# 새 프로젝트 열기

HJ가 #hq에서 `!project new <slug> <owner/repo>`라고 하면 총괄이 아래를 순서대로 한다. HJ가 할 일은 이 명령 한 번과, 저장소가 없을 때 GitHub에 빈 저장소를 만드는 것뿐이다.

## 0. 먼저 확인

- `slug`는 영문 소문자와 하이픈만. [projects/](../projects/)에 같은 이름이 없어야 한다.
- GitHub 저장소가 있는지 확인한다. 없으면 HJ에게 만들어 달라고 하고 멈춘다(저장소 생성은 권한 작업이다).
- 한 줄 정의, 대상 사용자, 첫 관문을 HJ에게 묻는다. 답이 없으면 비워 두고 서비스PM의 첫 작업으로 넘긴다.
- 에이전트 구성(대표, 서브에이전트, 이 문서의 절차)은 여기서 확정하고, 프로젝트가 끝날 때까지 바꾸지 않는다. 진행 중에 나온 개선안은 hq LEARNINGS에 적어 두고 프로젝트 사이에 반영한다(LEARNINGS 2026-11-26).

## 1. 레지스트리

`projects/<slug>.md`를 [projects/README.md](../projects/README.md)의 형식으로 만든다. 페르소나 이름을 HJ가 정하지 않았으면 "서비스PM", "개발PM"으로 둔다. hq `main`에 커밋한다.

## 2. 저장소

1. PC의 `C:/Users/styne/orca/projects/<slug>`에 클론한다.
2. [templates/project/](../templates/project/)의 파일을 복사한다. 이미 같은 파일이 있으면 덮어쓰지 않고 HJ에게 보고한다.
3. `{{...}}` 자리를 레지스트리 값으로 채운다.
4. `.claude/agents/`와 `.codex/agents/`에 서브에이전트를 내보낸다([agents/README.md](../agents/README.md)의 런타임 매핑).
5. 라벨을 만든다: `ready`, `in-progress`, `review`, `changes-requested`, `qa`, `release-ready`, `owner-decision`.
6. 브랜치 `setup/agents`로 커밋하고 PR을 연다. 문서만 있으므로 총괄이 바로 병합해도 된다.

## 3. 디스코드

1. PROJECTS 카테고리에 `#<slug>` 채널을 만든다.
2. 그 채널에 `dev` 스레드를 만든다.
3. 채널 ID와 스레드 ID를 레지스트리에 적고 커밋한다. 릴레이와 브릿지는 레지스트리를 다시 읽는다.
4. GitHub 웹훅은 #hq-alerts로 보낸다. 웹훅 생성은 권한 작업이므로 HJ에게 설정할 값만 알려 준다.

## 4. 첫 인사

`#<slug>`에서 서비스PM이 세 줄로 시작한다: 이 프로젝트에 대해 아는 것, 비어 있는 것(한 줄 정의, 대상, 성공 지표, 관문), HJ에게 처음 물을 것 하나.

## 4-1. 개요 관문 (기획·개발 전)

서비스PM은 기획서나 개발 Issue보다 먼저 `docs/product/OVERVIEW.md`를 쓰고 첫 관문으로 HJ에게 올린다. 통과 전에는 `ready` Issue를 만들지 않는다. 컨셉이 바뀌면 개요부터 다시 쓴다.

1. 배경과 목적: 왜 지금 이것을 하는가.
2. 대상 한 사람과 그 사람의 하루.
3. 목표 밸류: 누구의 어떤 순간이 얼마나 나아지는가(business).
4. 성공 지표와 마일스톤: 측정 방법, 목표값, 근거 또는 가정(business).
5. 쓸 수 있는 리소스와 활용 계획: 크레딧, 유료 API, 데이터, 예산 상한(business).
6. 죽는 전제와 확인 방법(challenger).

관문은 최소 셋을 둔다: 개요, 첫 화면(화면이 처음 동작하면 HJ가 직접 본다, ux 검토 후), 마감 D-2 범위 고정. 프로젝트 파일 `gates`에 적는다.

## 5. 완료 확인

- `!status`가 새 채널에서 올바른 프로젝트와 작업 폴더를 보여 준다.
- dev 스레드에서 서비스PM이 `TASK_READY`로 테스트 Issue를 넘기면 개발PM이 받는다. 확인한 뒤 테스트 Issue는 닫는다.
- 총괄이 #hq에 "열었다"와 링크(채널, 저장소, 레지스트리)를 보낸다.

## 프로젝트 닫기

HJ가 `!project archive <slug>`라고 하면: 레지스트리 `status`를 `archived`로 바꾸고, 채널을 ARCHIVE 카테고리로 옮기고, 서비스PM이 마지막 인수인계를 쓴다. 저장소와 채널은 지우지 않는다.

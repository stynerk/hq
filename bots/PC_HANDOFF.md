# PC Codex에 전달할 다음 작업

작성 기준: 2026-11-16. 클라우드에서 봇 코드와 오프라인 테스트를 준비했다. Windows PC·Discord·Claude/Codex 로그인은 여기서 실행하지 않았다. 구조 전환 완료로 처리하지 않는다.

## 2026-11-16 PC 사전 검증

- Node 24.20.0, Claude Code 2.1.325, Codex CLI 0.169.0을 확인했다. Windows에서 `npm ci`, 전체 테스트 65개, `.mjs` 구문 검사와 `git diff --check`가 통과했다. 실제 봇 연결과 로그온 자동 실행은 아직 검증하지 않았다.
- 독립 QA에서 paused 프로젝트가 채널 생성·작업 실행 대상에 포함되는 결함을 찾아 수정했다. `!hq init`은 active 프로젝트만 구성하고 paused 프로젝트의 기존 채널은 그대로 둔다. 두 봇은 paused 메시지와 대기 작업을 거부한다. 회귀 테스트 3개를 추가했다.
- onemorestep issue-9는 커밋된 작업이며 최초 확인 시 미커밋 변경이 없었다. OurAdventure의 미커밋 작업과 양쪽 로컬 설정은 Git 밖 비공개 체크포인트에 복사하고 SHA-256으로 대조했다. 기존 봇·토큰·프로젝트 작업은 삭제하지 않았다.
- active onemorestep의 로컬 JSON은 이미 유효하다. paused OurAdventure의 옛 ensure-relay hook은 재개 전에 백업 후 제거해야 한다. 서비스PM 승인·main 병합 뒤에만 설치한다.
- 서비스PM 검토에서 현재 봇 멘션 누락과 오래된 로컬 main 기반 서비스 작업 트리 생성을 지적했다. 두 런타임 프롬프트에 레지스트리의 자기·상대 멘션을 넣었고 서비스 작업 트리는 fetch한 origin/main을 사용한다. 기존 작업 트리는 추적 파일 변경 없이 fast-forward 가능할 때 자동 최신화한다. 수정 중이거나 squash 등으로 이력이 갈라졌으면 보존하고 Cap에게 복구를 안내한다. 실제 임시 Git 원격으로 main 병합 이후 재실행·미추적 파일 보존·추적 수정 보존·squash 분기 거부를 확인했다. 재검토 전에는 설치하지 않는다.

## 현재 범위

- 새 Discord 채널·스레드 ID는 `config/discord.md`의 `project_channels.<slug>`에만 저장한다. 기존 `projects/*.md`의 ID는 이전 설정 호환을 위해 읽기만 하며 `!hq init`은 프로젝트 파일을 수정하지 않는다. 새 설정이 있으면 그 값을 우선하고 null도 존중한다. 새 프로젝트 파일에는 실제 ID를 쓰지 않는다.

- onemorestep 먼저 전환. Our Adventure는 paused 유지, 그다음 이전.
- Git 규칙 정본 유지. 소라=서비스PM(Claude), Cap=개발PM(Codex).
- bots-v1 PR 검토 후 서비스PM 승인·개발 QA를 거쳐 main 병합. 사용자 PC 설치와 서버 재구성은 그다음.
- 루트 MIGRATION.md의 3~6단계 체크박스는 실제 PC 검증 전까지 완료로 바꾸지 않는다.

## 실행할 일

1. `C:/Users/styne/orca/hq`의 PR과 `AGENTS.md`, `docs/HANDOFF_SETUP.md`, `bots/INSTALL.md`를 읽는다. 미클론이면 클론한다. 설치는 main 병합 후 한다. 검토 중인 브랜치에서는 테스트만 한다.
2. 기존 봇 3종의 실행 창·프로세스·시작 경로를 확인하고 기록한다. 토큰이나 private 내용은 응답에 노출하지 않는다. 새 봇 가동 전에 기존 Codex 브릿지, PM_Sora, HJ Company 플러그인만 종료한다.
3. 프로젝트별 `git status`·현재 브랜치·작업 트리를 확인한다. OurAdventure 미커밋은 승인된 backup 브랜치에 보존한다. onemorestep의 issue-9 작업도 보존하고 작업 트리로 옮긴다. 본 폴더를 main으로 바꾼 뒤 `git pull --ff-only origin main`으로 최신화하되 미커밋 변경을 버리거나 작업 브랜치를 병합하지 않는다. `.worktrees/`를 기존 ignore 파일 또는 로컬 `.git/info/exclude`에 중복 없이 추가한다. 서비스 작업 트리는 fetch한 `origin/main`에서 생성한다. 이미 있으면 추적 파일 변경 없이 fast-forward가 가능할 때만 자동 최신화한다. 수정 중이거나 이력이 갈라졌으면 Cap이 상태·브랜치·변경을 백업하고 별도 작업 트리에서 최신 main과 대조해 복구한 뒤 재시도한다. 자동 reset·clean·일반 merge는 하지 않는다.
4. `.claude/settings.local.json`은 파일별로 로컬 비공개 사본을 만든 뒤 JSON 문법·잘못된 소라 경로·옛 ensure-relay 시작 hook만 정리한다. 다른 권한·설정은 보존한다. 백업 파일도 Git에 올리지 않는다.
5. `bots/install.ps1`을 실행한다. 현재 사용자 로그온 작업 2개, 의존성·테스트·preflight 통과를 확인한다. 첫 Claude 실행을 보이는 콘솔에서 하며 기존 토큰 자동 가져오기를 우선한다. 토큰을 채팅으로 요구하지 않는다.
6. 등록된 봇 ID, 서버 ID, Message Content Intent와 채널·스레드 권한을 확인한다. HJ Company DM에 `!hq init`을 실행해 HQ/PROJECTS/ARCHIVE, 프로젝트 채널과 dev 스레드를 만든다. 채널은 삭제하지 않는다. paused 프로젝트도 등록된 기존 channel_id가 있으면 위치를 보존하지만, ID가 null인 미등록 텍스트 채널은 ARCHIVE로 이동하므로 실행 전에 이동 대상을 확인한다. 채널을 그대로 둘 필요가 있으면 총괄이 실제 채널을 확인해 레지스트리에 먼저 등록한다. 저장된 ID와 hq main 커밋·푸시를 확인한다.
7. `export-agents.mjs`로 onemorestep 에이전트 파일을 생성한다. `qa`, `release-ready` 라벨 존재 여부를 확인해 없으면 생성한다. 정책 파일 삭제와 옛 봇 폴더 정리는 검증 뒤 한다.
8. 실제 테스트 Issue로 `TASK_READY → PR → 검토 → QA`를 검증한다. 현재 릴레이 출력은 요청 채널로 전송하므로 dev 스레드에서 소라를 불러 시작한다. 본문에서 dev로 자동 전달하는 기능은 없다. 병합 뒤 다음 소라 요청도 정상 실행되는지 확인한다. 키워드 없는 협의는 쓰기 불가, 일반 채널 봇 인계 무시, 중복 message ID 재수신 0건, `!stop` 대기열 취소, 미등록 채널 0건을 확인한다. 로그인 제한·사용량 제한은 실패로 보고하며 성공으로 기록하지 않는다.
9. 로그아웃/재로그인 또는 재부팅 후 자동 실행과 중복 실행 0건을 확인한다. 실제 로그 파일에는 자격 증명이 없어야 한다.
10. 그 뒤에만 onemorestep 전환 기간 문구·옛 봇 폴더를 정리한다. OurAdventure 문서·티켓 이전은 MIGRATION 6단계에 따라 별도 PR로 진행한다. GitHub 웹훅과 권한 조정은 HJ 작업으로 남긴다.

## 남은 검증 한계

- 테스트는 Discord API 모의 객체 및 CLI stdio 모의 실행이다. 실제 Windows 작업 스케줄러, DPAPI, 설치된 CLI 버전·사용량, Discord 종단 간 연결과 재부팅은 미검증.
- Claude 릴레이 첨부파일 수신은 명시적으로 미지원. 텍스트/Git 문서를 사용한다. Codex 기존 첨부 처리는 유지했다.
- 새 프로젝트 명령은 채널·레지스트리 생성까지 담당한다. 저장소 생성·공개·권한 변경은 자동으로 하지 않는다.
- 문서·에이전트 정의 변경은 승인 범위에 따라 따로 검토한다. custom Codex 에이전트 호출 실패 시 생성 TOML 지시문을 worker에게 전달하는 안내는 런타임 프롬프트에 넣었다.

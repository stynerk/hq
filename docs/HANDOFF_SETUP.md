# 운영 구조 전환 핸드오버 (Claude → ChatGPT/Codex)

작성: 2026-11-16 13:30 KST, Claude. HJ의 Claude 사용량이 얼마 남지 않아 남은 세팅을 ChatGPT/Codex가 이어받는다. 이 문서 하나만 읽고 이어서 할 수 있게 썼다. 결정의 근거는 [DECISIONS.md](../DECISIONS.md), 단계 현황은 [MIGRATION.md](../MIGRATION.md).

## 1. 목표

HJ의 프로젝트마다 **서비스PM**(Claude, HJ와 기획·방향)과 **개발PM**(Codex, 개발·QA·릴리즈)을 두고, 각 대표 에이전트가 서브에이전트를 지휘한다. 대화 창구는 디스코드다. 채널이 늘면 총괄 봇이 `!project new`로 PM을 배치한다. 문서 기록의 정본은 Git의 Markdown이다.

```
HJ
└ 총괄 hq-lead (Claude, #hq)
   └ 프로젝트마다
      ├ 서비스PM (Claude, #<프로젝트>) → researcher, reviewer
      └ 개발PM  (Codex, #<프로젝트> › dev 스레드) → implementer, qa, release
```

## 2. HJ가 확정한 것 (2026-11-16, 다시 묻지 말 것)

- 정본은 Git. 드라이브 `해커톤 출전팀` 폴더·팀 로그 시트는 보관용 (안내 문서 추가함)
- 봇은 둘: **Claude 릴레이**(기존 HJ Company 봇 토큰 + PC의 `claude` CLI 로그인) = 총괄·서비스PM, **Codex 브릿지**(Codex_bot) = 개발PM. 채널 → 프로젝트·페르소나는 hq `projects/*.md` 프론트매터로 정한다
- 자율 범위: 저장소 안 편집·테스트·브랜치 커밋·PR은 자동. 병합은 서비스PM 승인 + 개발PM QA 통과. 배포·비용·공개·권한·외부 연락은 HJ
- 봇에 디스코드 채널 관리 권한을 준다. `!project new`가 채널과 dev 스레드를 만든다
- 봇끼리는 dev 스레드에서 대화. 실행은 상대 멘션 + 키워드 + `#Issue번호`일 때만. HJ 메시지 없이 6번 넘게 주고받으면 멈춤
- 봇은 Windows 로그인 시 자동 실행, 죽으면 재시작
- `_to_delete/`로 옮긴 일회성 파일은 바로 삭제해도 됨
- Our Adventure 로컬은 미커밋 변경을 `backup/` 브랜치에 커밋 후 `main`으로 전환
- **onemorestep을 먼저, 지금 전면 전환** (기획 단계라 위험 낮음). Our Adventure는 그다음

## 3. 끝난 것

| 무엇 | 위치 |
|---|---|
| 0단계 대응표 (문서 53개 처리 방침, 충돌 C1~C5, 결정 D1~D3) | Claude Sheets "에이전트 운영 문서 대응표 (0단계)" (HJ 계정) |
| hq 골격: playbooks 6, agents 8, projects 2, config, templates, DECISIONS·LEARNINGS·METRICS·MIGRATION | stynerk/hq `main` (`1449ed7`~`c8eac78`) |
| onemorestep 저장소 문서 전환: CLAUDE.md·AGENTS.md를 hq 기준으로, `HANDOFF_CTO.md`→`HANDOFF_DEV.md`, `HANDOFF_SERVICE.md` 신설, ROLE_PM·WORKFLOW는 `docs/archive/`, DECISIONS 정본화 | stynerk/onemorestep `main` `1e6f629`. 열린 브랜치 3개(issue-7, issue-9, design-main-home-wireframes)는 새 main에 충돌 없이 병합됨을 확인 |
| 드라이브 안내 문서 | `해커톤/해커톤 출전팀/00_이 폴더는 보관용입니다` |
| 봇 공통 모듈 (작성 중) | hq 브랜치 `bots-v1`: `bots/shared/registry.mjs`, `bots/shared/routing.mjs`, 테스트 14개 통과 |

## 4. 지금 PC 상태 (2026-11-16 확인)

- `C:/Users/styne/orca/` 아래: `discord-codex/`(Codex 브릿지, 실행 중), `discord-sora/`+`sora-claude/`+`start-sora.cmd`(PM_Sora 봇), `onemorestep/`(Cap의 `issue-9-api-providers` 브랜치 체크아웃), `OurAdventure/`(`docs/prd-v2-group-stamp-tour` 브랜치에 멈춤). **hq는 아직 PC에 없다.**
- HJ Company 봇(Claude 디스코드 플러그인)은 Orca에서 OurAdventure 폴더 세션으로 실행 중. 설정 폴더는 보호 위치라 직접 확인 못 함(아마 `~/.claude/channels/discord/`).
- Codex 브릿지 문제: `allChannels: true`라 모든 채널의 HJ 메시지에 반응(소라와 이중 응답), 작업 폴더가 지정 안 된 채널은 OurAdventure에서 실행, 서버 전체에 작업 1개만, 봇 간 인계는 HJ Company↔OurAdventure 채널만 허용.
- `onemorestep/.claude/settings.local.json`: JSON 문법 오류(`\U` 이스케이프)와 소라 설정 경로 불일치. `OurAdventure/.claude/settings.local.json`: Claude 세션 시작 시 옛 Codex 릴레이를 켜는 훅(`ensure-relay.ps1`) → 새 브릿지와 포트 38471 충돌 가능. 둘 다 전환 때 정리.
- 디스코드 ID는 hq `config/discord.md`. HJ Company ID(`1563042220230053928`)는 추정값(`verified: false`).

## 5. 남은 일 (순서대로)

### 5-1. 봇 코드 (hq 브랜치 `bots-v1`, `bots/` 폴더)

`bots/package.json` 하나(deps: discord.js, yaml). `npm test`로 전체 테스트.

**이미 있는 것**
- `shared/registry.mjs`: `loadRegistry(hqRoot)` → `{ownerId, guildId, claudeBotId, codexBotId, hqChannelId, alertsChannelId, archiveCategoryId, projects, byChannel, agents, errors}`, `Registry`(파일 바뀌면 다시 읽음), `locate(reg, channel)`(채널·dev 스레드·프로젝트 채널 하위 스레드), `updateFrontmatter(file, fn)`(본문 보존).
- `shared/routing.mjs`: `classify(message, {self:'claude'|'codex', reg, repliesToSelf, exchangeCount})` → `ignore | unregistered | loop-limit | command | chat{lane, role, project, place, mode: owner|execute|consult, keyword}`. `ExchangeCounter`, `chunk`. 규칙은 [playbooks/discord.md](../playbooks/discord.md)와 같다. 키워드: Codex가 받는 `TASK_READY`, `REVIEW_CHANGES`, `QA_READY` / Claude가 받는 `REVIEW_REQUEST`, `QA_RESULT`.
- `codex-bridge/`: 기존 `discord-codex` 코드를 **변경 없이** 복사한 상태(`bridge.mjs`, `rpc.mjs`, `profiles.mjs`, `attachments.mjs`, 테스트). 아직 수정 안 함.

**Codex 브릿지 개편 (`codex-bridge/bridge.mjs`)**
1. `private` 폴더는 환경 변수 `BRIDGE_PRIVATE_DIR`, 기본값 `C:/Users/styne/orca/discord-codex/private` (기존 토큰·세션 재사용). hq 경로는 `HQ_ROOT`, 기본값 `C:/Users/styne/orca/hq`.
2. `handleMessage` 앞단을 `Registry` + `classify(self:'codex')`로 교체. `channelInput`/`trustedHandoff`/`allChannels`/`channelWorkspaces` 의존 제거. 등록 안 된 채널은 실행 거부(`unregistered`면 한 줄 안내).
3. 작업 폴더 = `project.localPath`. DM(`hq-reader`)은 hq 폴더, `sandbox: 'read-only'`.
4. `mode: consult`(키워드 없는 봇 협의)는 `sandbox: 'read-only'`로 답만. `execute`는 `workspace-write`, 앞에 "Issue #N을 hq agents/dev-pm.md 흐름대로 처리" 지시.
5. `developerInstructions`에 hq `agents/dev-pm.md` 본문 + `projects/<slug>.md` 본문 + 페르소나 이름(`project.devPm.name`)을 넣는다. 기존 안전 문구(첨부, 자격 증명, 승인)는 유지.
6. 전역 `active`/`starting`/`pendingHandoff` → 프로젝트(lane)별 `Map`. 알림·승인은 `threadId`로 lane을 찾는다. `!stop`은 그 채널 lane만.
7. `ExchangeCounter`를 등록 채널의 모든 메시지에 `record`. `loop-limit`이면 무시하고 채널에 한 번만 "봇끼리 6회 초과, 서비스PM이 owner-decision으로 올려 주세요".

**Claude 릴레이 (`claude-relay/relay.mjs`, 새로 작성)**
1. discord.js 클라이언트, 인텐트: Guilds, GuildMessages, DirectMessages, MessageContent.
2. 토큰: `private/config.json`에 DPAPI 암호화 저장(브릿지의 `dpapi()`와 같은 방식). 첫 실행 때 `~/.claude/channels/discord/.env`의 `DISCORD_BOT_TOKEN`을 가져오고, 없으면 콘솔에서 입력받는다. 시작 시 `client.user.id`가 hq `config/discord.md`의 `claude_relay.user_id`와 다르면 경고하고 파일을 고친 뒤 `verified: true`.
3. 메시지마다 `classify(self:'claude')`. `chat`이면 lane별로 하나씩 실행(lane별 큐).
4. 실행: `claude -p --output-format json --append-system-prompt-file <tmp> [--resume <sessionId>] --permission-mode acceptEdits --allowedTools ...`, 프롬프트는 **stdin**으로(Windows 인용 문제 회피). JSON의 `session_id`를 `private/state.json`에 `lane|channelId` 키로 저장, `result`를 `chunk`로 보낸다. 20분 타임아웃, `!stop`은 자식 프로세스 종료.
   - cwd: 총괄 = hq 폴더, 서비스PM = `<localPath>/.worktrees/service`(없으면 먼저 `git worktree add .worktrees/service main` 후 사용).
   - allowedTools: 서비스PM·총괄 = `Read Edit Write Glob Grep WebSearch WebFetch Task TodoWrite "Bash(git *)" "Bash(gh *)"`, consult = `Read Glob Grep`.
   - 시스템 프롬프트 파일 = hq `agents/<role>.md` 본문 + 프로젝트 파일 본문 + "너의 이름은 {servicePm.name}" + 모드 안내 + "디스코드 답은 짧게, 상세는 Issue·PR·문서에".
5. 명령: `!status`(프로젝트·작업 폴더·세션·작업 중 여부), `!new`(그 lane 세션 삭제), `!stop`.
6. `!hq init`(HJ, 어디서나 1회): HQ·PROJECTS·ARCHIVE 카테고리, `#hq`·`#hq-alerts` 생성, 등록된 프로젝트 채널을 PROJECTS로 이동, dev 스레드가 없으면 생성, 나머지 텍스트 채널은 ARCHIVE로 **이동만**(삭제 금지). ID를 `config/discord.md`·`projects/*.md`에 `updateFrontmatter`로 쓰고 hq `main`에 커밋·푸시.
7. `!project new <slug> <owner/repo>`(#hq): 채널+dev 스레드 생성 → `projects/<slug>.md` 작성(형식은 [projects/README.md](../projects/README.md)) → 커밋·푸시 → 총괄 세션에 [playbooks/new-project.md](../playbooks/new-project.md) 2~5절 수행을 지시.

**서브에이전트 내보내기 (`tools/export-agents.mjs <프로젝트 경로>`)**
- hq `agents/subagents/*.md` 중 `runtime: claude` → `<프로젝트>/.claude/agents/<name>.md` (프론트매터 `name`, `description`, `tools` + 본문, 맨 위에 "hq에서 생성, 여기서 고치지 말 것" 주석).
- `runtime: codex` → `<프로젝트>/.codex/agents/<name>.toml`: `name`, `description`, `sandbox_mode`(= `sandbox`), `developer_instructions = """본문"""`. 필수 키는 name, description, developer_instructions(OpenAI Codex 문서).
- 알려진 이슈: 세션에서 커스텀 에이전트를 이름으로 못 부르는 경우가 있다. 그래서 hq `agents/dev-pm.md`에 "안 되면 해당 TOML의 developer_instructions를 읽어 worker 서브에이전트에 넘긴다"를 추가할 것.

**설치 (`bots/install.ps1`)**
1. git, node(22+), codex, claude가 PATH에 있는지 확인.
2. `bots`에서 `npm ci`.
3. 작업 스케줄러에 "HQ Codex Bridge", "HQ Claude Relay" 등록: 로그온 시 실행, 숨김 창, 실패하면 재시작(`run.ps1`이 무한 루프로 재시작하고 `private/*.log`에 기록).
4. 옛 실행 정리 안내: Orca의 Codex 브릿지 창, PM_Sora(`start-sora.cmd`), HJ Company 플러그인 세션을 닫는다. 같은 토큰으로 두 프로세스가 붙으면 이중 응답이 난다. 브릿지는 포트 38471이 이미 쓰이면 스스로 종료한다.

### 5-2. PC 설치와 전환 (HJ 또는 Cap)

```powershell
git clone https://github.com/stynerk/hq C:\Users\styne\orca\hq
cd C:\Users\styne\orca\hq; git checkout bots-v1   # main 병합 전이면
powershell -ExecutionPolicy Bypass -File bots\install.ps1
```

1. 봇 역할에 권한 부여(HJ): 채널 관리, 공개 스레드 만들기, 스레드 관리, 메시지 읽기·보내기.
2. 디스코드 DM으로 HJ Company에 `!hq init`.
3. onemorestep 본 폴더를 `main`으로(Cap 브랜치는 작업 트리로 옮김), `node bots/tools/export-agents.mjs C:/Users/styne/orca/onemorestep` 결과를 커밋.
4. onemorestep에 `qa`, `release-ready` 라벨 생성.
5. 전환이 확인되면 onemorestep `CLAUDE.md`·`AGENTS.md`의 "전환 기간" 절 삭제, `start-sora.cmd`·`sora-claude/`·`discord-sora/`는 `_to_delete/`.
6. GitHub 웹훅을 `#hq-alerts`로(HJ).

### 5-3. 검증 (완료 조건)

- `#onemorestep`에서 HJ 메시지에 소라만 답한다. Cap은 멘션했을 때만.
- dev 스레드에서 소라가 `@Codex_bot TASK_READY #테스트Issue`를 보내면 Cap이 받아 PR까지 간다. 키워드 없는 멘션은 읽기 전용으로 답만.
- 같은 메시지를 다시 보내도 중복 실행 0건, `!stop` 이후 새 실행 0건.
- 등록 안 된 채널에서는 아무도 실행하지 않는다.
- PC 재부팅 후 두 봇이 자동으로 뜬다.

### 5-4. 그다음

- Our Adventure 이전([MIGRATION.md](../MIGRATION.md) 6단계).
- `bots-v1`을 hq `main`에 병합(테스트 통과 후). 세션에 GitHub API 권한이 없어 PR을 못 열었으므로 PR을 만들거나 HJ 확인 후 병합.

## 6. 주의

- 규칙(`playbooks/`, `agents/`)을 바꾸려면 HJ 확정 후 커밋하고 `DECISIONS.md`에 한 줄.
- 디스코드 ID는 `config/discord.md`와 `projects/*.md` 값만 쓴다. 채팅 기록으로 추정하지 않는다.
- 토큰, `private/`는 커밋하지 않는다(`bots/.gitignore`).
- onemorestep 제출 마감은 2026-11-25 23:59 KST. 봇 전환이 늦어지면 옛 봇(PM_Sora, 기존 Codex 브릿지)으로 계속 작업할 수 있게 전환 기간 절을 남겨 두었다.

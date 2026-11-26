# 구조 전환 현황

2026-11-16에 시작한 에이전트 운영 구조 전환의 진행 상황이다. 문서별 처리는 대응표(Claude Sheets, "에이전트 운영 문서 대응표 (0단계)")에 있고, 결정은 [DECISIONS.md](DECISIONS.md)에 옮겼다.

## 단계

| 단계 | 내용 | 상태 |
|---|---|---|
| 0 | 드라이브·저장소 문서 대응표 | 완료 (2026-11-16) |
| 1 | hq 골격: playbooks, 에이전트 정의, 레지스트리, 템플릿, 공통 기록 | 완료 (2026-11-16) |
| 2 | onemorestep 저장소 문서 전환 (HJ 결정으로 순서 변경) | 완료 (2026-11-16, onemorestep `1e6f629`) |
| 3 | 봇: Codex 브릿지 레지스트리화·채널별 병렬, Claude 릴레이, 서브에이전트 내보내기, 자동 실행 | 완료 (2026-11-17, onemorestep 기준). 서브에이전트 내보내기는 미확인 |
| 4 | 디스코드 재구성과 `!project new`, onemorestep 봇 전환 | onemorestep 전환 완료 (2026-11-17 HJ 확정). `!project new`는 6단계에서 검증 |
| 5 | 처음부터 끝까지 검증 | onemorestep 완료 (HANDOFF_SETUP §5-3 전 항목 통과, 아래 기록) |
| 6 | Our Adventure를 표준 구조로 이전하고 전환 | 완료 (2026-11-17, Tony·Cap. ouradventure #33~#35, PR #32·#49). 스킬 이전은 보류 |

## 맥미니 이전 (2026-11-26)

봇 호스트를 Windows PC에서 Mac mini(macOS, PM2)로 옮겼다. 아래 3단계의 Windows 경로·작업 스케줄러 항목은 맥미니에서 PM2(hq #27, PR #31)로 대체됐다.

| 항목 | 판정 | 근거 |
|---|---|---|
| Tony·Cap 응답 | 통과 | 11-26 #hq에서 둘 다 답함 (HJ 확인) |
| PM2 두 앱 `tony`·`cap` online | 통과 | 11-26 `pm2 ls`: 둘 다 online, 재시작 1회(PR #32 반영 재시작) |
| git push·PR 생성 | 통과 | `gh auth setup-git`, git 사용자 정보 설정(HJ) 뒤 PR #32·#34 생성 |
| 서비스 작업 트리 검증 | 수정 | `/var` → `/private/var` 심볼릭 링크로 실패, hq #33·PR #34 |
| 재부팅 뒤 자동 시작 | 통과 | 11-26 재부팅 직후 `pm2 ls`: `tony`·`cap` online, uptime 54초, 재시작 0회, 새 pid(1437·1439) |
| 재부팅 뒤 중복 응답 0건 | 통과 | 재부팅 뒤 첫 #hq 메시지에 Tony·Cap 각 1회 응답 (HJ 확인 "이상없음") |

맥미니 이전 완료 (2026-11-26, HJ 확인).

## 6단계: Our Adventure (원래 2단계)

- [x] 미커밋 변경을 `backup/2026-11-16-local` 브랜치에 커밋하고 push, 본 폴더를 `main`으로 전환 (Cap, #33: 184개 파일)
- [x] `.worktrees/`의 일회성 스크립트·PR 본문·커밋 메시지 파일을 `_to_delete/`로 옮긴 뒤 삭제. Git 작업 트리는 병합 여부 확인 후 `git worktree remove` (작업 트리 16개·파일 149개 정리. `test-tools`는 HJ 결정으로 보존, #33 예외 종료)
- [x] `.worktrees/discord-collaboration-draft.md`를 hq `docs/history/`에 사본으로 보관 (원본은 위 정리 때 함께 삭제)
- [x] (PR #32, 2026-11-17) 문서 이동: `docs/product/`(PRD v2, AI 코스 가이드), `docs/qa/`, `docs/tech/`(Firebase, T0, 경주 AI 핸드오버), `docs/reference/`(경주 일정), `docs/archive/`(Phase 1 계열 7개, 이전 인수인계, 루트의 PROJECT_INSTRUCTIONS·PROJECT_HANDOFF·NEW_PROJECT_START_PROMPT)
- [x] `docs/MVP_TICKETS.md`의 T0~T12를 GitHub Issue로 옮기고 문서는 아카이브 (#36~#48 생성, 완료 근거 있는 6개 닫음, PR #49 병합. 열린 7개는 제품 재개 때 Tony가 ready 지정)
- [x] (PR #32) 템플릿으로 `CLAUDE.md`, `AGENTS.md`, `docs/team/*`, `.github/` 생성. 기존 `docs/HANDOFF.md`의 최신 상태로 `HANDOFF_SERVICE.md`, `HANDOFF_DEV.md` 작성
- [ ] `.agents/skills/`(디자인 스킬 7종)를 hq `skills/`로 옮길지 결정 (Codex 스킬이므로 3단계 내보내기와 함께)
- [x] (PR #32) README 링크 갱신
- [x] PR #32(44개 파일, Pages 트리거 파일 변경 없음)를 Tony·Cap 합의로 병합

## 3단계: 봇

- [ ] PC에 hq 클론: `git clone https://github.com/stynerk/hq C:/Users/styne/orca/hq` (Cap 또는 HJ)
- [ ] Codex 브릿지 코드를 hq `bots/codex-bridge/`로 옮김. 토큰과 `private/`는 Git 밖
- [ ] 브릿지가 hq `projects/`를 읽어 채널 → 작업 폴더·페르소나를 정함. 등록되지 않은 채널은 실행 거부
- [ ] 전역 1작업 → 채널(프로젝트)별 큐
- [ ] 공유 채널에서는 멘션·답글일 때만 반응 (지금은 모든 채널의 HJ 메시지에 반응)
- [ ] Claude 릴레이 `bots/claude-relay/`: 기존 HJ Company 봇 토큰, PC의 `claude` CLI 로그인, 채널별 세션과 작업 폴더
- [ ] 봇끼리 키워드 실행과 6회 제한 ([playbooks/discord.md](playbooks/discord.md))
- [ ] 서브에이전트 내보내기 스크립트: hq `agents/subagents/` → `.claude/agents/*.md`, `.codex/agents/*.toml`
- [ ] Windows 로그인 시 자동 실행과 재시작 (작업 스케줄러)
- [ ] `onemorestep/.claude/settings.local.json`(PC 로컬, JSON 오류와 경로 불일치)은 Claude 릴레이 전환 때 정리

## 4·5단계: 디스코드와 검증

- [ ] 봇에 채널 관리 권한 부여 (HJ)
- [ ] HQ, PROJECTS, ARCHIVE 카테고리와 #hq, #hq-alerts 생성, ID를 [config/discord.md](config/discord.md)에 기록
- [ ] 기존 채널을 ARCHIVE로 이동 (#onemorestep은 11-25까지 그대로)
- [ ] GitHub 웹훅을 #hq-alerts로 (HJ)
- [ ] 테스트 프로젝트로 `!project new` → `TASK_READY` → PR → 검토 → QA → 병합까지 한 번. 같은 메시지 재전송 시 중복 실행 0건, `!stop` 이후 새 실행 0건
- [x] Our Adventure 채널 생성 (`!project new`, 2026-11-17, hq `ceb0167`). 전환은 6단계

## onemorestep 운영 검증 기록 (HANDOFF_SETUP 5-3, 2026-11-17 전환 완료)

2026-11-17 05시 기준. 전환 완료 판정은 미검증 항목이 모두 통과한 뒤 HJ가 한다.

| 항목 | 판정 | 근거 |
|---|---|---|
| #onemorestep 기본 응답은 소라만 | 통과 | |
| Cap은 멘션·답장·`!codex`에만 응답 | 통과 | |
| ARCHIVE 채널 무시 | 통과 | 카테고리 밖 미등록 채널은 미검증 |
| `!stop` 대기열 취소 | 통과 | |
| 키워드 없는 협의는 읽기 전용 | 통과 | |
| dev 인계 전 구간 자동 | 통과 | #15: TASK_READY → REVIEW_REQUEST → QA_READY → QA_RESULT를 HJ 개입 없이, PR #16 merge `94480f6`. #13에서는 Cap 신호가 첫 줄이 아니라 실패했고 hq PR #5로 수정 |
| 같은 메시지 재전송 시 중복 실행 0건 | 통과 | 재부팅 뒤 Tony·Cap 각 1회 응답. 처리한 메시지 ID가 `state.json`에 남아 재부팅 후에도 유지 |
| 재로그인·재부팅 뒤 자동 시작, 중복 없음 | 통과 | 02:27:49 두 봇 각 1회 시작. 단 `Stop-ScheduledTask`는 node 자식을 남긴다(LEARNINGS) |
| 로그에 자격 증명 없음 | 통과 | 메시지 처리 기록도 남지 않음 |
| 미등록 일반 채널(카테고리 밖) 무시 | 통과 | #논의 포럼 테스트(11-17): 실행 0건, Tony는 #hq에 1회 알림. Cap이 채널에 남긴 안내 한 줄은 hq PR #8로 제거(PC 재시작 후 반영) |

재부팅 직후 Tony가 서비스 작업 트리 갈라짐으로 답하지 못했다. 01:46 Tony가 로컬에만 남긴 커밋 때문이며, HJ가 백업(`backup/service-20261117`) 후 reset해 복구했다. 재발 방지는 hq PR #7(병합).

후속 수정 후보: `run.ps1` 종료 시 node 자식 정리, 메시지 처리 로그(내용·비밀 제외), Codex 기본 완료 문구, 릴레이 첨부파일 지원, 소라 작업 트리 pull, `playbooks/discord.md` 3절 문구(키워드는 어느 줄 맨 앞이든) 총괄 수정안.

## HJ가 직접 할 일

- [ ] ChatGPT 프로젝트(One More Step, OurAdventure) 지침을 hq 링크만 남기도록 수정
- [ ] 봇 채널 관리 권한, GitHub 웹훅 (4단계)
- [ ] Our Adventure 서비스PM·개발PM 이름 정하기 (선택)

## 드라이브

- [x] `해커톤/해커톤 출전팀` 폴더에 안내 문서 "00_이 폴더는 보관용입니다" 추가 (2026-11-16)
- 팀 로그 `E_백로그`의 열린 항목(테스터 참여 확인, 관문 2·3 검수 패키지, Codex 클라우드 환경 확인, Gemini 리뷰어 전환)은 onemorestep `HANDOFF_SERVICE.md`의 열린 결정과 다음 할 일로 옮겼다. Issue화는 소라가 한다.

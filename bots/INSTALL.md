# Windows PC 전환

이 설치기는 현재 Windows 사용자로 실행한다. 관리자 권한, 봇 토큰의 Git 저장, 기존 프로세스 강제 종료를 사용하지 않는다.

## 설치 전

1. onemorestep/OurAdventure의 미커밋 작업을 보존한다. 본 폴더나 브랜치를 자동 변경하지 않는다.
2. git, Node.js 22+, Codex CLI, Claude CLI를 설치하고 각 CLI 로그인을 확인한다.
3. 기존 Codex 브릿지, PM_Sora(start-sora.cmd), HJ Company Discord 플러그인을 닫는다. 같은 토큰을 두 프로그램이 쓰면 이중 응답이 발생한다.

```powershell
git clone https://github.com/stynerk/hq C:\Users\styne\orca\hq
Set-Location C:\Users\styne\orca\hq
# 아래 설치는 PR 검토·병합 후 main에서 실행한다.
git checkout main
git pull --ff-only
powershell -ExecutionPolicy Bypass -File bots\install.ps1
```

설치기는 의존성 설치와 테스트 후 로그온 작업 두 개를 등록한다. 기본적으로 즉시 시작하지 않는다. 포트 38471 사용 중이면 설치를 중단한다. 기존 Codex 자격 증명은 `C:\Users\styne\orca\discord-codex\private`에서 재사용한다. 다른 경로는 `-BridgePrivateDir`로 지정한다.

설치 전 `onemorestep/.claude/settings.local.json`의 JSON 오류와 옛 소라 경로를 백업 후 정리한다. OurAdventure 재개 전에는 `ensure-relay.ps1` 자동 실행 hook도 백업 후 제거한다. 설치기의 preflight가 활성 프로젝트의 잘못된 JSON과 옛 봇 시작 hook을 발견하면 작업 등록 전에 멈춘다. 설정 내용·토큰은 출력하지 않는다.

## 첫 실행과 확인

```powershell
# Claude 토큰 초기화는 보이는 콘솔에서 먼저 수행한다.
$env:HQ_ROOT = (Get-Location).Path
node bots\claude-relay\relay.mjs
# 확인 후 Ctrl+C로 닫고 자동 실행 작업을 시작한다.
Start-ScheduledTask -TaskName 'HQ Codex Bridge'
Start-ScheduledTask -TaskName 'HQ Claude Relay'
```

봇 권한(채널 관리·스레드 만들기·스레드 관리·메시지 읽기/보내기)과 Message Content Intent는 Discord에서 확인한다. HJ Company DM의 `!hq init`으로 등록 채널과 dev 스레드를 구성한다. 실제 서버와 CLI 통합 검증 전에는 이전 봇 폴더를 삭제하지 않는다.

```powershell
node bots\tools\export-agents.mjs C:/Users/styne/orca/onemorestep
# 생성 파일을 검토하고 해당 프로젝트 브랜치에서 커밋한다.
Get-ScheduledTask -TaskName 'HQ Codex Bridge','HQ Claude Relay'
Get-Content bots\private\codex.log -Tail 40
Get-Content bots\private\claude.log -Tail 40
```

에이전트 내보내기는 직접 만든 기존 동명 파일을 덮어쓰지 않는다. Codex에서 이름으로 에이전트를 호출할 수 없으면 생성 TOML의 `developer_instructions`를 읽고 worker에 전달한다. 에이전트 파일 자동 탐색 여부는 CLI 버전에서 별도 확인한다.

## 완료 조건

| 확인 | 기대 결과 |
|---|---|
| 프로젝트 본문에서 HJ 메시지 | Claude만 기본 응답, Codex는 멘션할 때 응답 |
| dev 스레드 TASK_READY + Issue | 해당 프로젝트만 작업 |
| 키워드 없는 봇 협의 | 읽기만 가능 |
| 동일 Discord 메시지 재수신 | 중복 실행 없음 |
| !stop | 해당 lane 실행과 대기 작업 중단 |
| 미등록 채널 | 작업 실행 없음 |
| Windows 재로그인 | 두 작업 자동 실행 |

## 중지와 복귀

```powershell
Stop-ScheduledTask -TaskName 'HQ Codex Bridge'
Stop-ScheduledTask -TaskName 'HQ Claude Relay'
Disable-ScheduledTask -TaskName 'HQ Codex Bridge'
Disable-ScheduledTask -TaskName 'HQ Claude Relay'
```

새 프로세스가 종료된 것을 확인한 뒤 이전 실행 방식으로 복귀한다. 토큰을 공유하는 프로세스를 동시에 재시작하지 않는다. 새 경로의 로그·세션과 기존 `private`는 보존한다. 자동 실행을 없애려면 작업 스케줄러의 위 두 작업만 삭제한다.

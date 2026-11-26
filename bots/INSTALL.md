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

# macOS Mac mini에서 PM2로 실행

Node.js 22 이상, Codex CLI와 Claude CLI를 봇을 실행할 macOS 사용자로 준비한다. 두 CLI에 로그인하고, 같은 토큰을 쓰는 다른 호스트의 봇은 테스트 전에 중지하거나 별도 테스트 토큰과 레지스트리를 사용한다. 레지스트리의 owner 및 각 봇 ID가 사용할 Discord 계정과 일치해야 한다.

프로젝트의 macOS 경로가 이미 등록되어 있으면 해당 경로를 쓴다. 기존 Windows 경로는 `HQ_ROOT`의 상위 폴더에서 같은 체크아웃 이름으로 찾는다. 예를 들어 `C:/Users/example/orca/OurAdventure`는 macOS에서 HQ 옆의 `OurAdventure`를 사용한다. hq 프로젝트는 `HQ_ROOT` 자체를 사용한다.

## 1. PM2와 의존성 설치

저장소 루트에서 실행한다.

```sh
npm install --global pm2
npm --prefix bots ci
```

## 2. 환경 파일 배치

```sh
if [ ! -e bots/.env ]; then
  install -m 600 bots/.env.example bots/.env
fi
chmod 600 bots/.env
```

`bots/.env`를 편집해 운영할 봇의 별도 토큰과 경로를 설정한다. PM2는 각 앱에 `bots/.env` 경로만 전달한다. 각 봇이 시작할 때 그 파일을 직접 읽는다. 파일은 봇 실행 사용자가 소유한 권한 `0600` 일반 파일이어야 한다. 토큰은 파일에서 각 봇으로만 읽으며 PM2의 앱 환경이나 CLI 자식 프로세스의 환경으로 내보내지 않는다. 파일 변경은 아래 재시작 명령으로 반영한다.

`CODEX_EXECUTABLE`과 `CLAUDE_BIN`을 비워 두면 PM2 프로세스가 상속한 `PATH`에서 각각 `codex`, `claude`를 찾는다. 부팅 환경에 CLI 디렉터리가 없다면 해당 실행 파일의 절대 경로를 `bots/.env`에 지정한다. 공백이 있는 경로는 예시처럼 따옴표로 감싼다. 경로 설정은 프로세스 환경 변수가 `bots/.env` 값보다 우선한다.

Codex는 기본적으로 `~/Library/Application Support/orca/codex-accounts`에서 Business 계정을 탐색한다. `CODEX_ACCOUNTS_ROOT`를 설정하면 저장된 `routing.json`의 `managedAccountsRoot`보다 우선한다. 계정 경로가 다른 Windows의 `routing.json`은 복사하지 않는다. 새 파일 첫 시작에는 Business 계정을 자동으로 고르고, 한도 오류가 나면 같은 루트에서 탐색한 다음 Business 계정을 사용해 `profiles.business.home`을 갱신한다. 계정 순서를 직접 관리하려면 `profiles.business.homes`에 macOS 계정 홈의 절대 경로를 순서대로 적는다. 명시적으로 설정한 프로필의 계정 홈과 목록이 자동 탐색보다 우선한다.

## 3. 봇 시작

```sh
cd bots
pm2 start ecosystem.config.cjs --only tony,cap
```

PM2의 앱 이름은 Claude 릴레이가 `tony`, Codex 브리지가 `cap`이다. Thanos는 같은 Claude 릴레이 진입점을 사용하는 별도 `thanos` 앱이다.

### Thanos 운영 반영

1. HJ가 `bots/.env`에 Thanos 토큰을 `THANOS_DISCORD_BOT_TOKEN`으로 넣는다. 봇과 채널 ID는 `config/discord.md`에서 읽는다. 제한 모드를 지원하는 Claude Code 2.1.248 이상을 사용한다.
2. HJ가 병합 후 운영 체크아웃을 갱신하고, 등록된 채널에서 Thanos가 채널을 보고 메시지를 보낼 수 있는지 확인한다. Thanos는 Message Content Intent 없이 직접 멘션된 메시지를 받는다.
3. 저장소 루트에서 아래 명령으로 Tony 라우팅을 반영하고 Thanos 앱을 시작한다.

```sh
git pull --ff-only
pm2 restart tony
pm2 start bots/ecosystem.config.cjs --only thanos
pm2 save
```

4. HJ가 등록된 `#hq`와 활성 프로젝트 본문에서 각각 한 번 Thanos를 멘션하고, 해당 채널의 Thanos 응답을 확인한다. `#thanos`에서도 직접 멘션으로 부른다. 멘션 없는 메시지, dev 스레드의 멘션에는 Thanos 응답이 없어야 한다. Thanos만 호출하면 Tony는 기본 응답을 보내지 않는다.
5. 아래 부팅 시작 안내에 따라 등록한 뒤, HJ가 재부팅 후 `pm2 status`에서 `thanos`가 `online`인지 확인한다. Issue 또는 PR에 응답과 재부팅 후 상태의 증거를 남긴다.

## 4. 부팅 시 시작 등록

운영 전환 시 HJ가 앱을 실행한 사용자로 현재 목록을 저장하고 macOS의 부팅 시작을 등록한다. `pm2 startup`이 명령을 출력하면 해당 명령을 실행한다.

```sh
pm2 save
pm2 startup
```

## 5. 상태와 로그 확인

```sh
pm2 status
pm2 logs tony --lines 20 --nostream
pm2 logs cap --lines 20 --nostream
```

검증할 때 두 프로세스가 `online`이고 각 Discord 연결 메시지가 찍혔는지 확인한다. 등록된 hq 채널에서 각 봇을 멘션해 서로 다른 고정 문구로 답하도록 요청하고 실제 응답을 확인한다. Codex 응답은 PM2 환경의 `codex`, Tony 응답은 `claude` 실행을 각각 확인한다. 별도 테스트 스레드에서 Tony 응답을 생성하던 중 `!stop`으로 중지한 뒤 다음 요청이 완료되는지도 확인한다. PR에는 macOS·Node.js·PM2·두 CLI 버전, 두 프로세스의 시작 및 Discord 응답 결과, Windows 실행 결과를 기록한다. 토큰과 인증 파일 내용은 제외한다.

## 6. 재시작과 복귀

```sh
pm2 restart tony cap
```

복귀할 때는 `pm2 stop tony cap`로 중지한 뒤 이전 호스트를 재시작한다. 설정과 세션은 보존한다.

## 7. 구글 드라이브 연결 (산출물 전달)

드라이브는 산출물을 보내고 HJ가 올리거나 고친 파일을 확인하는 데만 쓴다. 정본은 Git의 md다(DECISIONS 2026-11-27). Tony는 `bots/tools/drive.mjs`의 `send`·`read`만 실행하고 rclone 자체는 실행하지 못한다.

1. `brew install rclone`
2. 구글 클라우드에서 전용 OAuth 클라이언트를 만든다. rclone 공용 client_id는 2026년 중 종료된다.
   - 새 프로젝트 → Google Drive API 사용 설정
   - OAuth 동의 화면: 외부, 범위 `drive.file`·`drive.readonly`, **프로덕션으로 게시**(테스트 상태면 7일마다 로그인이 끊긴다)
   - 사용자 인증 정보 → OAuth 클라이언트 ID → 데스크톱 앱
3. `rclone config`로 연결 두 개를 만든다. client_id와 client_secret은 2번 값을 둘 다에 넣는다.

| 이름 | scope | root_folder_id | 용도 |
|---|---|---|---|
| `gdrive` | `drive.file` | 비움 | 보내기. rclone이 만든 `HQ` 폴더 안만 다룬다 |
| `gdrive-ro` | `drive.readonly` | `HQ` 폴더 ID(드라이브 주소 `folders/` 뒤) | 읽기. HJ가 웹에서 올린 파일도 보인다 |

4. 확인

```sh
rclone mkdir gdrive:HQ
node bots/tools/drive.mjs read
```

연결 이름이나 최상위 폴더가 다르면 `.env`에 `HQ_DRIVE_REMOTE`, `HQ_DRIVE_READ_REMOTE`, `HQ_DRIVE_ROOT`를 넣는다. `~/.config/rclone/rclone.conf`는 Git에 올리지 않는다.

## 로컬 QA

저장소 루트에서 `node --test bots/codex-bridge/`가 `MODULE_NOT_FOUND`를 내는 Node.js 버전에서는 테스트 파일을 지정한다. 이 명령은 브리지의 `*.test.mjs`와 기존 `test.mjs`를 실행한다.

```sh
node --test "bots/codex-bridge/*.test.mjs" bots/codex-bridge/test.mjs
npm --prefix bots test
```

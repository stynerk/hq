# Cap(Codex) 계정 전환

Cap이 쓰는 ChatGPT 비즈니스 계정이 사용 한도에 걸렸을 때 다른 비즈니스 계정으로 바꾸는 절차. 2026-11-18 처음 사용했다.

## 계정 폴더

| 이름 | 경로 |
|---|---|
| 기본 (Orca가 관리) | `C:\Users\styne\AppData\Roaming\orca\codex-accounts\911a8f18-40dd-4531-b696-892517e4c747\home` |
| business2 | `C:\Users\styne\orca\codex-accounts\business2` |

계정을 새로 추가할 때만 로그인한다. PowerShell 실행 정책 때문에 `codex`가 아니라 `codex.cmd`를 쓴다.

```
$env:CODEX_HOME = "C:\Users\styne\orca\codex-accounts\<이름>"; codex.cmd login
```

## 전환

PowerShell에서 한 줄씩 실행한다. 첫 줄의 경로만 바꾼다.

```
$f = "C:\Users\styne\orca\discord-codex\private\routing.json"; $j = Get-Content $f -Raw | ConvertFrom-Json; $j.profiles.business.home = "<위 표의 경로>"; [IO.File]::WriteAllText($f, ($j | ConvertTo-Json -Depth 10))
```
```
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'bridge\.mjs' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

10초 뒤 Cap이 새 계정으로 다시 뜬다. 디스코드에서 Cap에게 아무 요청이나 보내 확인한다.

- 비즈니스 플랜이 아니면 Cap이 "워크스페이스 유형이 다릅니다"로 거부한다.
- 대화 맥락은 계정마다 따로다. hq PR #10 반영 뒤에는 Cap이 알아서 새 대화로 시작한다. 그 전에는 채널·스레드마다 `@Cap !new`를 보낸다. 작업은 "Issue #N 이어서"로 다시 지시한다.

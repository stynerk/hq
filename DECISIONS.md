# 확정된 결정 (프로젝트 공통)

HJ가 확정한 운영 결정을 날짜순으로 쌓는다. 프로젝트 고유 결정은 각 프로젝트의 `docs/team/DECISIONS.md`에 있다. 새 결정은 아래에 한 줄씩 추가하고, 뒤집힌 결정은 지우지 않고 "→ 대체: 날짜"를 붙인다.

| 날짜 | 결정 | 근거 |
|---|---|---|
| 2026-11-10 | 검수 요청은 산출물 전문이 아니라 선택지로 올린다. HJ는 읽지 않고 고른다 | Our Adventure 병목 경험 (드라이브 G_누적규칙) |
| 2026-11-10 | HJ의 기본 창구는 PM(서비스PM)이다. PM은 프로젝트 전반을 점검하고, 개발 쪽은 개발 세부를 책임진다 | HJ 지시, 팀 구성 (G_누적규칙) |
| 2026-11-11 | 개발 작업의 원장은 GitHub Issue다 | HJ 지시 (G_누적규칙) |
| 2026-11-11 | PM이 승인한 PR은 HJ 승인 없이 `main`에 병합한다. 배포, 결제, 저장소 공개는 HJ가 한다 | 팀 셋업 (G_누적규칙) |
| 2026-11-12 | ~~봇끼리 디스코드 메시지로 서로를 깨우지 않는다. 인계는 GitHub에서만~~ → 대체: 2026-11-16 | HJ 결정, 절충안 (G_누적규칙) |
| 2026-11-16 | 문서 기록의 정본은 Git이다. 에이전트 운영 문서는 모두 Markdown으로 hq와 각 프로젝트 저장소에 둔다. 드라이브와 팀 로그 시트는 보관용 | HJ 결정 |
| 2026-11-16 | 대표 에이전트(총괄, 서비스PM, 개발PM)가 서브에이전트를 지휘하는 구조로 바꾼다. 프로젝트마다 서비스PM(HJ와 기획·방향)과 개발PM(개발·QA·릴리즈)을 둔다 | HJ 결정 |
| 2026-11-16 | 디스코드 봇은 역할별 둘이다. Claude 릴레이(기존 HJ Company 봇, PC의 claude 로그인)가 총괄과 서비스PM, Codex 브릿지(Codex_bot)가 개발PM. 채널별 프로젝트·페르소나는 hq `projects/`로 정한다 | HJ 결정 |
| 2026-11-16 | 새 프로젝트는 #hq에서 `!project new`로 연다. 봇에 채널 관리 권한을 준다 | HJ 결정 (추천안) |
| 2026-11-16 | 봇끼리는 dev 스레드에서 대화한다. 작업 실행은 `TASK_READY` 등 키워드와 Issue 번호가 있을 때만. HJ 없이 6번 주고받으면 멈추고 owner-decision으로 | HJ 결정 (추천안), [playbooks/discord.md](playbooks/discord.md) |
| 2026-11-16 | 자율 범위: 저장소 안 편집·테스트·브랜치 커밋·PR은 자동, 병합은 서비스PM 승인 + 개발PM QA 통과. 배포·비용·공개·권한·외부 연락은 HJ | HJ 결정, [playbooks/decision-rights.md](playbooks/decision-rights.md) |
| 2026-11-16 | 병합 규칙은 모든 프로젝트 공통이다. Our Adventure의 "머지는 사용자 승인"(MVP_TICKETS, 10-26)을 대체한다 | HJ 결정 (대응표 C3) |
| 2026-11-16 | 인수인계는 역할별 파일을 세션마다 통째로 새로 쓴다(HANDOFF_SERVICE, HANDOFF_DEV) | HJ 결정 (대응표 C4) |
| 2026-11-16 | 에이전트끼리 같은 체크아웃을 쓰지 않는다. 본 폴더는 `main`, 서비스PM은 문서 작업 트리, 개발 서브에이전트는 Issue별 작업 트리 | HJ 결정 (대응표 C5) |
| 2026-11-16 | HJ 피드백·검수 지표는 Git의 [METRICS.md](METRICS.md)에 기록한다 | HJ 결정 (대응표 D1) |
| 2026-11-16 | ChatGPT 프로젝트 지침에는 Git 저장소 링크만 두고 내용을 복사하지 않는다 | HJ 결정 (대응표 D2) |
| 2026-11-16 | 드라이브 `해커톤 출전팀` 폴더는 그대로 두고 안내 문서 하나만 추가한다 | HJ 결정 (대응표 D3) |
| 2026-11-16 | ~~onemorestep은 해커톤 제출(11-25) 후에 새 구조로 전환한다. Our Adventure를 먼저 전환한다~~ → 대체: 2026-11-16 | HJ 결정 (추천안) |
| 2026-11-16 | onemorestep을 먼저, 지금 전면 전환한다(기획 단계에서 멈춰 있어 위험이 낮다). Our Adventure는 그다음 | HJ 결정 |
| 2026-11-16 | Our Adventure 로컬 폴더는 미커밋 변경을 `backup/` 브랜치에 커밋한 뒤 `main`으로 전환한다 | HJ 승인 |
| 2026-11-16 | 정리 대상 일회성 스크립트·임시 파일은 `_to_delete/`로 옮긴 뒤 바로 삭제해도 된다 | HJ 승인 |
| 2026-11-16 | 디스코드 봇은 Windows 로그인 시 자동 실행하고, 죽으면 자동 재시작한다 | HJ 승인 |
| 2026-11-17 | Claude 쪽 대표는 CPO Tony(#hq 총괄 + 모든 프로젝트 서비스PM), Codex 쪽 대표는 CTO Cap(모든 프로젝트 개발PM). 프로젝트별 PM 이름(소라 등)은 쓰지 않는다 | HJ 결정 |
| 2026-11-17 | Tony·Cap이 합의하면 병합한다. 되돌릴 수 없는 변경, 서비스 정지 위험, 권한·비밀값·결제·공개, hq `bots/` 코드, 결정 권한 문서 변경만 HJ가 병합한다 | HJ 결정 |
| 2026-11-17 | onemorestep 봇 전환 완료. 다음: 전환 기간 절 삭제(onemorestep Issue), 옛 봇 정리, Our Adventure 전환 | HJ 확정 (§5-3 전 항목 통과) |
| 2026-11-17 | Our Adventure 전환: Tony·Cap이 실행(`!project new`, Issue), 상태는 active로 바꾸되 제품 개발은 11-25 뒤 HJ가 재개 결정, 새 채널 #our-adventure(예전 #ouradventure는 ARCHIVE 보존) | HJ 결정 |
| 2026-11-17 | 봇끼리 6회 제한은 Issue 번호별로 센다(협의는 스레드 단위) | HJ 결정 (선택지 1). 코드는 hq PR #9 |
| 2026-11-17 | Our Adventure PC의 `test-tools` 작업 트리는 인증·운영 파일이 있어 그대로 두고 #33을 예외로 닫는다 | HJ 결정 (선택지 1) |
| 2026-11-18 | Cap(Codex)은 사용 한도에 걸리면 등록된 다른 business 계정으로 자동 전환해 한 번 다시 시도한다. 한도 외 오류로는 계정을 바꾸지 않는다 | HJ 결정 (B안). 코드 hq PR #10, 절차 docs/runbooks/codex-account-switch.md |
| 2026-11-18 | 리뷰어(심사위원) 채점은 Gemini CLI로 한다. 개발(Cap)은 Codex 그대로. Gemini 로그인은 HJ가 PC에서 한다 | HJ 결정. 코드 hq PR #11 |
| 2026-11-18 | 리뷰어 Gemini는 무료 등급 API 키와 Flash 모델로 쓴다. 한도·품질이 부족하면 결제 연결 후 Pro로 바꾼다(GEMINI_REVIEW_MODEL) | HJ 결정 |
| 2026-11-18 | hq `bots/` 버그 수정 PR은 총괄이 HJ 허가 없이 병합한다(테스트 통과, 새 기능·권한 확대·보안·결정권 변경 제외) | HJ 결정. playbooks/decision-rights.md |
| 2026-11-18 | Claude 릴레이에 프로젝트별 예약 점검을 넣는다. onemorestep은 매일 10:00·15:00·18:00(KST). **이 건만 예외로** 서비스PM(Tony)이 코드·병합까지 맡고 Cap은 관여하지 않는다(프로젝트 진행 우선). 테스트 실행은 릴레이 세션이 할 수 없어 HJ가 PC에서 명령 두 개로 확인한다 | HJ 지시. hq Issue #15 |
| 2026-11-19 | 예약 점검은 dev 스레드에서 돌려 막힌 작업을 바로 Cap에게 인계한다(A안). HJ 결정이 필요하면 HJ를 멘션한다. onemorestep 점검 시각에 21:00·00:00·03:00·06:00을 더한다(하루 7회) | HJ 결정. 같은 예외로 Tony가 작성 |
| 2026-11-19 | 릴레이: dev 스레드 서비스PM 답의 HJ 멘션 문단을 프로젝트 채널로 옮기고, 예약 점검 시작 때 프로젝트 채널에 한 줄 알린다. 같은 예외로 Tony가 작성, HJ가 PR을 미리 승인 | HJ 결정(a안). hq Issue #20 |
| 2026-11-19 | 릴레이는 서비스PM 실행 때마다 같은 프로젝트의 다른 채널(프로젝트 채널 ↔ dev 스레드)에서 지난번 이후 새로 오간 메시지를 함께 넘긴다. 채널마다 세션이 달라도 맥이 끊기지 않게 한다 | HJ 결정(1번). 같은 예외로 Tony 작성, PR #21에 함께 |
| 2026-11-19 | 모든 프로젝트에 검증 하네스를 쓴다: QA 체크리스트(기획을 검사 가능한 규칙으로), 구현과 다른 세션의 브라우저 E2E, PR 맨 위 검증 결과 | HJ 결정. playbooks/workflow.md 7절, templates/project |
| 2026-11-19 | 테스트의 외부 API 호출은 기록·재생: 처음이거나 정답셋·평가셋·요청이 바뀌면 실제 호출해 기록, 같으면 재생. 쓰기 요청은 항상 모의 응답 | HJ 결정. playbooks/workflow.md 7절 |
| 2026-11-19 | 릴레이 무응답 점검: dev 스레드에 HJ·개발PM 글이 30분 없으면 서비스PM이 점검하고, 할 일이 없으면 조용히 끝낸다(NOOP). 반응이 없으면 60·120분으로 늘리고, 글이 오면 30분으로 되돌린다. 예약 점검은 그대로 | HJ 결정. 같은 예외로 Tony 작성 |
| 2026-11-26 | #hq에서 HJ가 Cap을 멘션하거나 Cap 메시지에 답글을 달면 Cap도 hq 읽기 전용으로 답한다. 기본 응답은 총괄, Cap만 부르면 총괄은 빠진다. 봇끼리는 #hq에서 주고받지 않는다 | HJ 지시, hq PR #28. playbooks/discord.md 2절 |
| 2026-11-26 | Codex 브릿지 계정 홈(모든 business 계정)의 config.toml에 `[sandbox_workspace_write] network_access = true`를 켠다. Cap의 쓰기 레인(dev 스레드)에서 gh·GitHub 조회가 되게 한다. read-only 레인은 그대로 차단. #27 PR은 Tony·Cap 합의로 병합(이 Issue만 bots/ 예외), Mac mini 접속은 HJ | HJ 결정. 계정을 새로 추가하면 같은 설정을 넣는다 |
| 2026-11-26 | Codex 브릿지: 승인 검토는 auto_review 유지. 쓰기 레인의 권한 추가 요청(item/permissions/requestApproval)은 요청한 만큼 그 턴에만 자동 허용, 읽기 전용은 차단 | HJ 결정, hq PR #30 |
| 2026-11-26 | 작업 트리를 새로 만들면 `npm --prefix bots ci`까지 실행한다(`bots/package-lock.json`이 있는 저장소) | HJ 지시. playbooks/workflow.md 5절, hq PR #34 테스트 로드 실패 |
| 2026-11-27 | 구글 드라이브는 산출물 전달용이다. 정본과 에이전트 사이 작업은 Git의 md 그대로(2026-11-16 결정 유지). Git에 커밋된 기획안·테스트 문서·데이터를 드라이브 `HQ/<프로젝트>/`로 한 방향으로 보내고(md→Google 문서, csv→Google 시트), HJ가 올리거나 고친 파일은 Tony가 읽기 전용으로 받아 Git에 반영한다. 에이전트는 rclone을 직접 쓰지 않고 `bots/tools/drive.mjs`만 쓴다 | HJ 결정. MCP·정기 동기화는 쓰지 않음 |
| 2026-11-26 | 대표는 Tony·Cap 유지, 역할은 서비스PM 서브에이전트로 늘린다: Jarvis(researcher, 착수 때 API 지도·경쟁 3개), Thanos(business, 신규), Loki(challenger, 신규), Fury(reviewer, 심사위원 3인), Friday(editor, 신규). Loki·Fury는 Gemini·Antigravity로 실행한다. 개발PM 내부 서브에이전트는 이름 없이 두고 qa는 시연 대본을 테스트로 실행한다 | HJ 결정. LinkedIn 공모전 사례 검토 |
| 2026-11-27 | hq `bots/` PR은 Tony 검토·테스트 통과 뒤 총괄이 병합한다(새 기능 포함). 권한 확대·보안·인증·결정권 변경은 HJ 병합 유지. 운영 반영(pull, pm2 restart)은 HJ | HJ 지시("이제 머지는 네가 해라"), PR #39 |

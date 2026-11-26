# Issue #44 개발 인계

- PM2의 `thanos`는 기존 Claude 릴레이를 `--thanos`로 실행한다. macOS의 `bots/.env`에서 `THANOS_DISCORD_BOT_TOKEN`을 읽고, Tony와 별도 PID·세션을 쓴다.
- Thanos는 기존 `#thanos`, `#hq`, 등록된 활성 프로젝트 본문에서 HJ 또는 Tony의 직접 멘션에만 답한다. dev와 일반 스레드는 제외한다. Tony는 Thanos에게만 향한 호출에 기본 응답을 보내지 않는다.
- 시장 조사는 #38의 Antigravity 공통 도구에 의존한다. #38 PR을 먼저 병합해야 한다.
- Tony 검토와 QA 다음에 HJ가 병합과 운영 반영을 진행한다. 토큰 설정, 운영 PM2 시작 및 재부팅 확인 절차는 `bots/INSTALL.md`에 있다.

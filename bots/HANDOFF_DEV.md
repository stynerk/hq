# Issue #44 개발 인계

- PM2의 `thanos`는 기존 Claude 릴레이를 `--thanos`로 실행한다. macOS의 `bots/.env`에서 `THANOS_DISCORD_BOT_TOKEN`을 읽고, Tony와 별도 PID·세션을 쓴다.
- Thanos는 기존 `#thanos`, `#hq`, 등록된 활성 프로젝트 본문에서 HJ 또는 Tony의 직접 멘션에만 답한다. dev와 일반 스레드는 제외한다. Tony는 Thanos에게만 향한 호출에 기본 응답을 보내지 않는다.
- 기존 채널과 봇 계정은 Discord에서 읽기 전용으로 확인했다. 실제 릴레이 진입점에 모의 Discord와 Claude를 연결해 응답 및 차단 경로를 검증했다. 운영 Discord 응답과 재부팅 후 자동 시작은 미확인이다.
- 전체 테스트는 154개 통과, 실패 0개, Windows 전용 DPAPI 1개 건너뜀이다.
- Tony 검토와 QA 다음에 HJ가 병합과 운영 반영을 진행한다. 토큰 설정, 운영 PM2 시작 및 재부팅 확인 절차는 `bots/INSTALL.md`에 있다.

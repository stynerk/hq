# Issue #27 개발 인계

- Mac mini에서는 PM2 구성과 권한 0600인 `bots/.env`로 두 봇을 실행한다. 공백이 있는 계정 디렉터리는 프로세스 인자와 환경 값으로 그대로 넘긴다.
- Windows의 작업 스케줄러 및 DPAPI는 그대로 사용한다. Mac mini는 새 `routing.json`을 만들며 자동 탐색과 한도 전환에 같은 계정 루트를 쓴다.
- Windows에서 실제 DPAPI로 모의 자격 증명을 복호화했고, 두 봇 진입점의 모의 Discord 응답과 Codex 모의 한도 전환 후 `routing.json` 저장을 확인했다. 기존 Windows 운영 프로세스 재시작과 Mac mini의 PM2·실제 Discord 확인은 남아 있다. `INSTALL.md`에 Mac mini 확인 절차를 적었다.
- Codex 0.169.0의 생성 스키마에서 PR #30의 `permissions`, `scope` 응답 필드를 대조했다. Node 24에서 `node --test bots/codex-bridge/`는 `MODULE_NOT_FOUND`를 반환했다. `INSTALL.md`의 테스트 파일 지정 명령으로 브리지 37개 테스트를 통과했다.

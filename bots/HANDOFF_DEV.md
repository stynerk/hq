# Issue #38 개발 인계

- `gemini-review.mjs`는 기존 Gemini CLI를 기본으로 쓴다. `GEMINI_REVIEW_ENGINE=antigravity`를 선택하면 Antigravity의 Gemini 4 Argon을 먼저 실행하고 실패 시 Gemini CLI로 재시도한다. `--role loki`와 `--role fury`는 각각 기존 지침을 사용한다.
- Antigravity에는 별도 임시 작업 폴더와 제한된 리뷰 에이전트를 사용한다. 초기 이벤트의 모델과 에이전트가 일치하면 stdin으로 자료를 전달한다. CLI의 진단 원문은 외부에 출력하지 않는다.
- Mac mini에서 Antigravity CLI v1.5.18의 기존 세션으로 Loki와 Fury를 각각 한 번 실제 실행했다. 합성 기획서에 대한 출력 원문은 PR 본문에 있다. Gemini 폴백 동작은 자동 테스트로 검증한다.
- `npm --prefix bots test`에서 149개 통과, Windows 전용 DPAPI 1개 건너뜀, 실패 0개를 확인했다.
- Tony 검토와 QA 다음에 HJ가 병합과 운영 반영을 한다. 운영 사용자에게 정식 `agy` 실행 파일이 준비되면 PATH 또는 `AGY_REVIEW_BIN`의 절대 경로를 확인하고 릴레이에 실행기 환경 변수를 적용한다.

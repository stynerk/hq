# Issue #37 개발 인계

- `drive.mjs read`는 단일 파일의 사전 메타데이터와 다운로드 결과에 각각 20 MiB 제한을 적용한다. 크기가 `-1`인 Google 문서도 내보낼 수 있으며 실패한 다운로드의 임시 폴더는 정리한다.
- 목록 조회는 깊이 3을 유지하고 그 경계의 하위 폴더를 출력한다. 사용자는 표시된 경로를 `read`에 다시 넘겨 더 깊은 파일을 볼 수 있다.
- 실제 읽기 전용 Drive에서 수정 전 두 버그를 재현했다. 수정 후 지정 Google 문서가 로컬 임시 폴더에 `README.md`로 내려왔고, 루트 목록의 `hq/bots/oauth-site/`와 `read hq/bots`의 `hq/bots/oauth-site/README.md`를 확인했다.
- `npm --prefix bots test`는 142개 통과, Windows 전용 DPAPI 1개 건너뜀, 실패 0개였다.
- Tony의 PR 검토와 QA가 다음 단계다. 병합과 운영 호스트의 `pm2 restart tony`는 HJ가 진행한다. Drive 시험 파일 삭제 여부는 HJ가 정한다.

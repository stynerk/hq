# oauth-site

Google OAuth 동의 화면(브랜드 정보)에 넣을 홈·개인정보처리방침·약관 페이지. `stynerk.github.io`로 게시한다. 게시(공개 저장소 생성)는 HJ가 한다.

## 게시

```sh
EMAIL='문의 받을 주소'
SRC=~/work/hq/bots/oauth-site   # 이 PR 머지 후 main 체크아웃 경로
DST=$(mktemp -d)/stynerk.github.io
mkdir -p "$DST" && cp -R "$SRC"/index.html "$SRC"/privacy "$SRC"/terms "$DST"/
grep -rl CONTACT_EMAIL "$DST" | xargs sed -i '' "s/CONTACT_EMAIL/$EMAIL/g"
cd "$DST" && git init -b main && git add . && git commit -m "OAuth brand pages"
gh repo create stynerk/stynerk.github.io --public --source . --push
```

1~2분 뒤 `https://stynerk.github.io/`, `/privacy/`, `/terms/`가 열린다. 사용자 사이트 저장소는 main 브랜치에서 Pages가 자동으로 켜진다. 안 켜지면 저장소 Settings → Pages에서 main / root를 고른다.

## 동의 화면에 넣을 값

| 항목 | 값 |
|---|---|
| 앱 홈페이지 | `https://stynerk.github.io/` |
| 개인정보처리방침 | `https://stynerk.github.io/privacy/` |
| 서비스 약관 | `https://stynerk.github.io/terms/` |
| 승인된 도메인 | `stynerk.github.io` |

승인된 도메인은 Google Search Console에서 소유 확인이 필요하다. Search Console이 주는 HTML 확인 파일을 저장소 루트에 올리면 된다.

## 문구와 실제 동작

페이지는 `drive.file`(보내기)과 HQ 폴더로 한정한 `drive.readonly`(읽기, `gdrive-ro`) 두 범위를 적었다. 동의 화면에 등록하는 범위와 맞춰야 한다. 범위를 바꾸면 이 페이지도 고친다.

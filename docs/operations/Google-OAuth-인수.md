# Google OAuth 설정·에디터 인수

2026-11-04 운영 인수 완료. 사용자가 서버에서 OAuth credential을 숨김 등록하고 code-lily만 재생성해 Healthy/readiness 200을 확인한 뒤, 실제 Google callback·OWNER·로그아웃·재로그인과 에디터 R2 업로드를 검증했다. 아래 설치 명령은 재실행 지시가 아닌 재현/복구 절차다. 운영 Google/R2 env를 초기화하거나 client를 중복 발급하지 않는다.

현재 Cloud는 `blog-codelily` 프로젝트, 앱 `code-lily`, 운영 웹 client `code-lily-production`, 외부/테스트 모드/지정 테스트 사용자 1명이다. callback 하나·JS origin 없음·AI 에이전트 옵션 해제다. 앱/DB 이미지·DNS·서버 SSH 정책은 바꾸지 않았고 OAuth env 반영을 위해 사용자가 앱 컨테이너만 재생성했다. Google Client ID/Secret·OAuth code/state·쿠키·로그인 프로필은 검증 산출물에 기록하지 않았다.

등록 도구는 Windows Google/R2 13개 중 11개 통과·Linux 전용 2개 skip 후, **사용자 서버 SSH의 Google 격리 테스트 7개 전부 OK·skip 0**으로 실제 Linux 0700/0600·원자적 저장/backup·취소/동시 수정 보존·PTY 비출력을 검증했다. 에이전트 자동 SSH 인증이 성공한 것은 아니다.

현재 남긴 데이터는 개인정보 없는 인수 초안 1개와 공개 PNG 1개다. 글은 공개 발행하지 않았고 검증 데이터/운영 콘텐츠를 삭제하지 않았다. 초안/객체 식별자는 Git 밖 비공개 검증 자료에만 둔다. 일반 회원 공개 전 브랜딩·정책/약관 URL·OAuth 게시 여부와 MEMBER/EDITOR 실계정 권한 인수를 이어간다.

일반 회원 공개 준비는 [정책·약관 초안과 공개 순서](Google-OAuth-공개준비.md)를 따른다. 기본 로그인 범위의 Google Testing 예외 때문에 테스트 사용자 등록 수를 서비스 가입 제한으로 해석하지 않는다.

## Google Cloud 등록

이 프로젝트의 초기 구성·정책 동의·client 발급·테스트 사용자 등록·최초 기본 정보 제공 동의는 단계별 사용자 승인 후 완료했다. [사용자 데이터 정책](https://developers.google.com/terms/api-services-user-data-policy)은 정보 이용 공개·최소 권한·credential 비밀 유지·안전한 데이터 처리를 요구한다. 일반 회원용 OAuth 게시와 추가 계정/권한은 별도 검토한다.

Google Auth Platform의 code-lily 전용 프로젝트를 선택한다. 다른 서비스의 기존 OAuth client를 재사용하지 않는다. 프로젝트/계정 선택이 불명확하면 운영자에게 확인한다. 공식 [클라이언트 관리](https://support.google.com/cloud/answer/15549257?hl=en)와 [웹 서버 OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)를 기준으로 설정한다.

1. Branding에 앱 이름 `code-lily`, 운영자가 관리하는 지원/개발자 연락처를 등록한다. Audience는 개인 Google 계정도 사용하는 External로 선택한다. 테스트 중이면 Audience의 테스트 사용자에 최초 OWNER `codelily98@gmail.com`을 등록한다. 일반 회원 공개 전에는 게시 상태·동의 화면과 필요한 검증을 별도로 확인한다.
2. Data Access는 로그인용 `openid`, `email`, `profile` 범위만 사용한다. Gmail·Drive·Calendar 등 추가 API 권한은 요청하지 않는다.
3. Clients에서 **Web application** 유형의 운영 전용 client를 만든다. Authorized redirect URI는 정확히 `https://blog.codelily.kr/api/auth/callback/google`이다. 와일드카드나 끝의 `/`를 추가하지 않는다. 이 구현은 서버 OAuth이며 브라우저 Google SDK를 쓰지 않아 JavaScript origin은 필수 설정이 아니다. 등록한다면 `https://blog.codelily.kr`만 사용한다.
4. 로컬 검증이 필요하면 별도 개발 client를 만들고 redirect URI를 `http://localhost:3000/api/auth/callback/google`로 둔다. 운영 client에 개발 callback을 혼합하지 않는다.
5. Client ID와 Secret은 생성 시 안전하게 보관한다. 공식 안내상 Secret은 나중에 다시 열람할 수 없을 수 있다. 채팅·Git·명령 인자·스크린샷·공유 로그로 전달하지 않는다. OAuth client JSON도 저장소 밖에서 보관한다.

Google의 redirect 등록 변경은 반영까지 시간이 걸릴 수 있다. `redirect_uri_mismatch`이면 실제 요청의 origin/path와 등록값을 비공개로 비교하고 인증서 검증·WAF를 통째로 해제하지 않는다.

## 서버에 숨김 입력

사용자가 파일 전송/SSH 명령을 실행한 뒤 `whoami=ubuntu`와 아래 Linux 테스트 7개 전부 OK·skip 0 출력을 제공했다. 이어 실제 env 등록과 앱 컨테이너 재생성이 완료됐고, Healthy/readiness 200과 브라우저 로그인 성공을 확인했다. 아래 명령은 복구용 참고 절차다.

`scripts/configure-google.py`는 **Linux 서버의 첫 등록 전용** 도구다. 두 값을 모두 숨김 입력하며, 각 형식을 즉시 검증해 잘못된 항목만 재입력한다. 기존 Google 값이 하나라도 있거나 중복 env key·다른 origin·기존 backup이 있으면 중단한다. Google의 유효성·웹 client 유형·redirect 등록 여부는 이 형식 검사로 확인되지 않는다.

기존 DB/R2/OWNER/auth secret은 보존한다. env 디렉터리 0700, 원본 backup과 새 env 0600, 임시 파일+원자적 교체를 사용한다. backup은 같은 비공개 디렉터리의 `code-lily.env.before-google`이며 Git 제외 대상이다. 입력 중 파일 변경을 감지하면 중단한다. 여러 관리자가 동시에 실행하지 않는다. 이미 입력한 credential 회전용으로 쓰지 않는다.

현재 자동 SSH 인증은 불가하므로 운영자가 기존 키로 접속 가능한 터미널에서 진행한다. 새 관리 키 등록이나 SSH 보호 완화는 이 절차에 포함하지 않는다. 새 파일이 아직 서버에 없으면 PC의 저장소 루트 PowerShell에서 전송한다.

```powershell
scp scripts/configure-google.py tests/google_setup_test.py iwinv-cloud:
ssh -t iwinv-cloud
```

서버 Bash에서 **먼저 격리 검증**한다. 테스트 fixture만 임시 폴더에 쓰며, 실제 Linux 권한과 PTY 입력 비출력까지 검사한다.

```sh
google_check_dir=$(mktemp -d /tmp/codelily-google-check.XXXXXX)
mkdir "$google_check_dir/scripts" "$google_check_dir/tests"
install -m 0600 "$HOME/configure-google.py" "$google_check_dir/scripts/configure-google.py"
install -m 0600 "$HOME/google_setup_test.py" "$google_check_dir/tests/google_setup_test.py"
python3 -m unittest discover -s "$google_check_dir/tests" -p google_setup_test.py -v
```

**7개 모두 OK, skip 0**을 확인한 경우에만 아래를 실행한다. 실패하면 오류 출력만 공유하고 실제 credential을 입력하지 않는다. 설치 대상은 현재 운영 checkout이다.

```sh
sudo install -m 0755 "$HOME/configure-google.py" /opt/codelily/scripts/configure-google.py
cd /opt/codelily
sudo python3 scripts/configure-google.py
```

입력 성공 전에는 env를 변경하지 않는다. 저장 중 오류나 중단이 있으면 env/backup 상태를 비공개로 확인한 후 재시도한다. 내용 전체를 `cat`, `docker inspect`, `compose config`로 출력하지 않는다. 숨김 입력을 사용할 수 없으면 `ssh -t`로 다시 접속한다.

## 현재 이미지로 설정 반영

저장 도구는 서비스를 재시작하지 않는다. 기존 앱 이미지를 유지하고 **code-lily만 재생성**해야 새 env가 반영된다. 이 단일 인스턴스에는 짧은 중단 가능성이 있다. 서버에서 빌드·migration·seed를 실행할 필요가 없다.

```sh
sudo docker compose --env-file infra/.env -f infra/compose.production.yml config --quiet
sudo docker compose --env-file infra/.env -f infra/compose.production.yml up -d --no-deps --force-recreate --wait code-lily
sudo docker compose --env-file infra/.env -f infra/compose.production.yml exec -T code-lily node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>{console.log('readiness',r.status);process.exit(r.ok?0:1)})"
```

공개 `/health/ready` 200, `/api/me`의 `googleConfigured: true`와 `private, no-store`, Posts·About 및 기존 naraebi 응답을 확인한다. 설정 유무는 실제 인증 성공을 뜻하지 않는다. 문제가 생기면 기존 보호된 backup을 검토해 env를 복원하고 code-lily만 같은 방식으로 재생성한다. auth secret·DB/R2 설정을 새로 생성하지 않는다.

## 실제 로그인·업로드 인수

- [x] 운영 브라우저에서 Google 로그인 → 의도한 Google 계정 선택 → callback 복귀를 확인한다. 비밀번호/2단계 인증은 사용자가 직접 수행한다. 계정 동의 화면의 범위를 확인하며 예상 외 권한은 승인하지 않는다.
- [x] 서버의 현재 DB 역할을 반영하는 `/api/me`와 `/manage`로 최초 사용자의 OWNER 권한을 확인한다. 이름·이메일·계정 ID·쿠키·OAuth code/state/token은 검증 기록에 남기지 않는다. 역할이 다르면 allowlist/검증 이메일 원인을 확인하며 DB 역할을 임의 상승시키지 않는다.
- [x] `/manage/posts/new`에 식별 가능한 인수용 글을 **초안**으로 작성한다. 공개 글로 자동 발행하지 않는다. HTML 서식·소스 보기와 저장 후 재열기를 확인한다.
- [x] `R2 이미지 업로드`에서 공개해도 되는 작은 PNG/JPEG/WebP/AVIF를 선택하고 필수 이미지 설명을 입력한다. `업로드 후 본문에 추가` → 성공 안내 → 미리보기 → 초안 저장/재열기의 실제 이미지와 alt를 확인한다. 초안에 넣어도 이 업로드는 **공개 R2 객체**를 생성하므로 개인 파일을 쓰지 않는다.
- [x] 브라우저 CORS/PUT/완료 API와 공개 이미지 GET을 확인한다. 서명 URL 전체·요청 쿠키를 기록하지 않는다. 같은 이미지의 CDN HIT·반응형 표시와 데스크톱/모바일 편집기의 가로 잘림·키보드 초점을 확인한다.
- [x] 별도 비로그인 창에서 초안 경로가 404이며 관리/쓰기 접근이 거절되는지 확인한다. 초안 이미지 자체를 비공개라고 표현하지 않는다.
- [x] 로그아웃 후 `/api/me`의 actor null과 개인 응답 no-store, 관리/쓰기 거절을 확인한다. 재로그인도 확인한다. 별도 MEMBER/EDITOR 실계정이 없으면 해당 실계정 인수는 미검증으로 둔다.
- [x] 인수 초안 1개/공개 검증 이미지 1개를 유지하고 식별자를 Git 밖에 보관했다.
- [ ] 운영자가 검증 데이터 보존/삭제를 결정한다. 다른 운영 콘텐츠나 테스트 객체를 일괄 삭제하지 않는다.
- [ ] 별도 MEMBER/EDITOR 실계정 권한과 일반 회원 공개 전 브랜딩/정책/약관 URL·OAuth 게시 여부를 검증한다.

결과는 프로젝트 문서와 진행현황에 명령·통과/미검증·다음 시작점을 기록한다. 로컬 fixture 세션 검증을 실제 Google 인증 성공으로 대체하지 않는다.

## 2026-11-04 실제 검증 근거와 한계

- 사용자가 서버 앱 재생성 Healthy/readiness 200 출력을 제공했고, 공개 readiness/Posts/naraebi 200과 `/api/me` 설정 true·private/no-store·CF DYNAMIC을 직접 확인했다.
- Google 계정 선택 → 이름/프로필 사진/이메일만 제공 동의(사용자 승인) → 운영 `/posts` 복귀 → 서버 OWNER → 관리 UI를 확인했다. Gmail/Drive/Calendar 권한은 없었다. 로그아웃 후 브라우저 actor null·관리 `/sign-in` 이동, 재로그인 후 같은 계정/OWNER/이미지 유지까지 확인했다.
- HTML 소스 제목/굵게/표 → 승인된 640×360 PNG(4,167바이트) R2 예약/PUT/완료 → 본문 이미지/alt → DRAFT 저장 → 새로고침/재로그인 뒤 복원을 확인했다. 공개 PNG 200/image/png·동일 SHA256·1년 immutable·연속 CDN HIT(후속 Age 48)다. 이미지 자체는 공개이며 초안 비공개와 혼동하지 않는다.
- 익명 초안 페이지 404·상세 API 401·업로드 POST 401·공개 목록 제외를 확인했다. 첫 검사의 상세 API 404 가정은 소스 계약을 확인해 401로 수정했다. 관리 요청은 Next 스트리밍의 HTTP 200 뒤 브라우저가 `/sign-in`으로 이동하므로 HTTP redirect만으로 판정하지 않았다.
- Edge/CUA의 desktop 1440×1100/mobile 390×844에서 의미 있는 화면·overlay 없음·미리보기 표/이미지·가로 잘림 없음·대체 텍스트·모달 내부 초점/Escape 복귀·console error/warning 0을 확인하고 Git 밖에 화면 근거를 보관했다. Browser 전용 skill은 미제공이며 CUA Browser UI API를 사용했고 외부 Playwright fallback은 하지 않았다. 임시 viewport는 원복했다.
- 파일 선택은 최초 확장의 로컬 파일 접근 권한 부족으로 실패했다(서버 전송 없음). 사용자가 직접 파일 URL 접근을 켠 뒤 재시작된 Edge 연결/기존 초안 탭을 다시 연결해 성공했다. Google navigation 중 CUA 일시 timeout은 위치/DOM을 재관측해 해결했으며 실제 앱 오류로 기록하지 않았다.
- 이번에는 전체 자동 접근성·NVDA/VoiceOver·라이트 테마 회귀·MEMBER/EDITOR 별도 실계정·모든 브라우저·부하/장기관측·R2 독립 백업을 검증하지 않았다. 초안/공개 PNG는 유지 상태이며 실제 공개 게시글을 만들지 않았다.

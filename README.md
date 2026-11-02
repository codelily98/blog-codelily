# Codelily

저장소: [codelily98/blog-codelily](https://github.com/codelily98/blog-codelily). 커밋 메시지는 한글로 작성합니다.

Next.js 풀스택 서비스와 공통 React 모듈을 함께 관리하는 workspace입니다. 첫 서비스는 자기소개·기술 블로그 **code-lily**이며 운영 도메인은 `blog.codelily.kr`입니다.

## 먼저 읽기

1. [공통 구현 규칙](AGENTS.md)
2. [작업 시작·다른 PC에서 재개](docs/작업-시작.md)
3. [진행현황](docs/진행현황.md)
4. [아키텍처 결정](docs/architecture/결정기록.md)
5. [프로젝트별 단계](docs/projects/code-lily.md)

## 개발 실행

Node 24 LTS를 사용합니다. 최초 설치 후 `.env.example`을 참고해 `apps/code-lily/.env.local`을 작성합니다. 공개 화면을 확인하는 데 Google/R2 키는 필요하지 않습니다. 설정 전 로그인·업로드는 설정 필요 상태를 반환합니다.

```sh
npm ci
npm run local:setup
docker compose up -d --wait
npm run db:migrate
npm run db:seed
npm run dev
```

Docker 앱 미리보기는 `npm run local:up`으로 시작합니다. host 개발 서버와 동시에 실행하지 않습니다. 컨테이너 중지는 `npm run local:down`, 실제 PostgreSQL·Redis 권한 검사는 `npm run verify:local`입니다. 로컬은 [compose.yaml](compose.yaml), 운영은 [infra/compose.production.yml](infra/compose.production.yml)로 관리합니다.

접속: `http://localhost:3000`. `DATABASE_URL`이 없으면 개발용 PGlite를 `.local/code-lily-db`에 사용합니다. seed는 이 저장소에서 작성한 예시 콘텐츠이며 실제 이력·프로필이 아닙니다. 운영 콘텐츠로 교체하고 공개 연락처를 검토한 뒤 배포합니다. seed는 비밀번호·Google 계정·운영 로그인 우회를 생성하지 않습니다.

## Google 전용 로그인

Google Cloud에서 OAuth Web application client를 만들고 다음 redirect URI를 등록합니다.

- 개발: `http://localhost:3000/api/auth/callback/google`
- 운영: `https://blog.codelily.kr/api/auth/callback/google`

`.env.local` 또는 서버의 비공개 환경변수에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, 충분히 긴 난수 `BETTER_AUTH_SECRET`을 설정합니다. `APP_URL`·`BETTER_AUTH_URL`은 실제 주소와 일치해야 합니다. `OWNER_EMAILS=codelily98@gmail.com`인 상태에서 검증된 해당 Google 계정으로 최초 가입하면 OWNER가 됩니다. 다른 Google 사용자는 MEMBER이며 OWNER가 관리 화면에서 EDITOR로 지정할 수 있습니다.

| 역할 | 권한 |
|---|---|
| 비로그인 | 공개 글·About 조회 |
| MEMBER | 댓글 작성·자기 댓글 삭제 |
| EDITOR | 자기 카테고리·글 작성/수정/삭제, 댓글 |
| OWNER | 모든 글·카테고리, About 항목, 회원 권한, 통계·감사 조회 |

가입·이메일/비밀번호 로그인 화면은 없습니다. 역할·소유권은 서버에서 검증합니다. 최초 OWNER 정책은 가입 시 적용되므로 기존 계정의 권한 변경은 별도 운영 절차로 수행해야 합니다.

## 구성

```text
apps/code-lily/src/
  app/                         Next.js page/route, 얇은 입출력 경계
  modules/
    posts/ about/ identity/ telemetry/ uploads/
      domain/                  모델·정책·port
      application/             사용 사례
      infrastructure/          SQL·인증·외부 adapter
      presentation/            기능별 화면
  infrastructure/database.ts   제한된 pg pool / 개발 PGlite
  composition.ts               adapter를 사용 사례에 연결
packages/
  ui/ editor/ charts/ grid/ content/ storage/ contracts/
infra/                         standalone·Tunnel·Caddy·PostgreSQL 설정
docs/projects/                 프로젝트별 단계·현황·다음 작업
```

공통 패키지는 특정 앱을 import하지 않습니다. 모든 UI는 공통 토큰·Tailwind를 사용하며 에디터·차트·Grid는 필요한 화면에서만 불러옵니다. HTML과 GFM Markdown은 서버에서 정제하고 공통 읽기 스타일을 적용합니다. 글 목록에는 본문을 전송하지 않습니다.

## 검증

```sh
npm run typecheck
npm run check:boundaries
npm test
npm run build
npm run test:e2e
```

Windows 브라우저 검증은 설치된 Chrome을 사용합니다. 다른 환경에서는 Playwright가 사용할 Chromium을 준비합니다. Browser 플러그인이 없어 Playwright를 사용했습니다. 자동 접근성 검사는 KWCAG/WA 전체 심사를 대체하지 않습니다.

관리 기능과 운영 ISR을 재현하려면 개발 서버를 종료하고 `npm run build` 후 첫 터미널에서 `npm run test:server`를 실행합니다. 이 명령은 localhost 55433의 메모리 PGlite wire fixture와 **실제 standalone 운영 서버**를 시작합니다. 운영 PostgreSQL 16의 성능·권한 격리 검사를 대신하지 않습니다. `.local/e2e-sessions.json`은 격리 테스트용 서명 세션이며 runtime 이미지에 fixture 생성 코드는 포함하지 않습니다.

별도 터미널에서:

```powershell
$env:CODELILY_AUTH_FIXTURE='1'
npm run test:e2e
```

Linux/macOS는 `CODELILY_AUTH_FIXTURE=1 npm run test:e2e`를 사용합니다. 실제 Google 인증·R2·Cloudflare 설정은 이 fixture로 검증되지 않습니다.

## 운영

[Cloudflare·Caddy·R2 운영 지침](docs/operations/Cloudflare-Caddy-R2.md), [배포·복구](docs/operations/배포-복구.md), [접근성 검증](docs/quality/접근성-검증.md)을 따릅니다. 현재 외부 서버·DNS·OAuth·R2에는 변경하지 않았습니다.

공개 Posts·상세·About은 ISR 300초와 저장 후 경로 재검증을 사용합니다. 정적 자산과 R2 공개 이미지는 Cloudflare CDN으로 전달하고 회원·관리 응답은 no-store로 처리합니다. 운영은 실제 PostgreSQL만 허용하며 빌드는 CI에서 수행합니다.

원본 레퍼런스는 [Dong-Ding 블로그](https://blog.dongding.dev/)와 [저장소](https://github.com/Kun-9/Dongding-Blog)입니다. 화면 구성과 테마 방향을 참고했으며 글·개인 이력·기존 소스는 복사하지 않았습니다.

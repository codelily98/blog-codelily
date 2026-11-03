# code-lily: 소개·기술 블로그

운영 도메인 `https://blog.codelily.kr` · 최초 OWNER `codelily98@gmail.com`

## 단계 1: 기반

- [x] Next.js App Router·기능 모듈·저장소 port·공통 패키지 구조 정의
- [x] SQL migration·개발 seed·PostgreSQL/PGlite adapter
- [x] 첨부 기준 Posts/About 레이아웃, 모바일, 라이트/다크

## 단계 2: 인증·권한

- [x] Google만 로그인/자동 가입, 서버 세션, 로그아웃
- [x] 검증 이메일 기반 초기 OWNER, MEMBER 기본값, EDITOR 소유권 정책
- [x] 모든 쓰기 DTO·Origin·권한·소유권·크기 제한
- [ ] 실제 Google OAuth callback 검증(외부 credential 필요)

## 단계 3: 콘텐츠

- [x] 카테고리 생성/수정, 카테고리별 목록·글 상세·검색·태그
- [x] 자기 Posts 관리, 초안/공개, 작성/수정/삭제
- [x] SunEditor HTML/Markdown, 안전한 렌더링, 표·코드·이미지
- [x] 로그인 MEMBER 댓글·자기 댓글 삭제·OWNER 관리
- [x] About 소개·경력·관심사·연락처·자유 항목의 개별 등록/수정/삭제·순서·공개
- [x] About 항목별 디자인(경력 타임라인, 관심사 chip, 연락처 link, 소개 본문)

## 단계 4: 운영 연결

- [x] 분석 동의·페이지 이벤트·업무 감사·기간별 Chart/Grid 조회
- [x] OWNER 전용 관리, 내부 버전 API와 서비스 인증 계약
- [x] R2 업로드 예약·완료 검증·공개 이미지·권한부 다운로드
- [ ] Google/DNS/R2/서버 실제 설정 및 부하·백업·인증서 갱신 검증

## 검증과 인수 조건

비로그인은 공개 글·About만 조회한다. MEMBER는 댓글만 쓰고 EDITOR는 자기 글만 수정하며 OWNER만 About과 권한을 관리한다. 다른 사람 ID 대입으로 권한을 우회할 수 없어야 한다. 초안·비공개 파일은 공개 URL/API에서 유출되지 않는다. HTML 이벤트·script·악성 링크를 정제하고 허용 서식은 유지한다. 모든 조작을 키보드로 수행하고 360px에서도 주요 내용이 잘리지 않아야 한다.

## 다음 시작점

2026-11-03: Ubuntu 26.04 iwinv [최초 배포 실행서](../operations/iwinv-최초배포.md), 운영 비밀 설정 생성 도구, 새 DB 3개 역할 초기화와 migration 후 권한 SQL, Redis healthcheck를 준비했다. 로컬 실제 PostgreSQL/Redis와 Linux 파일 권한 검증을 통과했다. 실제 SSH 접속·Docker Engine 29.9.2/Compose 5.7.0 설치·이미지 pull·NTS 시간 동기화 복구까지 완료했다. DB·앱·신규 Tunnel·Google/R2 인수는 이어서 진행하며 기존 `naraebi`를 유지한다.

2026-11-02: Windows standalone·Linux Docker 빌드, 타입·모듈 경계, 단위/SQL 통합 4개, 실제 Chrome 브라우저 5개를 검증했다. HTML 소스 보기의 최신 값 저장·안전한 스타일 보존, GFM 표, OWNER 게시/수정/공개 해제, MEMBER 댓글, About 개별 항목, Chart/Grid, 키보드 모달·테마·모바일·ISR HIT를 확인했다. 실제 Google 제공자 인증 왕복과 R2·운영 Cloudflare는 별도 대기다. 운영 OAuth·R2·DNS는 설정값 없이 성공 처리하지 않는다.


## 후속 인수 항목

2026-11-02 추가 동기화: Next.js 개발 모드의 자동 생성 타입 참조(`next-env.d.ts`)를 기록했다. 타입 검사와 diff 공백 검사를 통과했으며, 다음 작업은 아래 외부 연동 인수 항목이다.

- [ ] Google Cloud Web client를 설정하고 `codelily98@gmail.com` 실제 최초 OWNER 가입·로그아웃을 검증한다.
- [ ] Cloudflare Tunnel/WAF·Caddy DNS-01·R2 bucket/custom domain/CORS를 실제 계정에서 설정한다.
- [ ] 실제 서버 부하·백업 복원·ACME 갱신·NVDA/VoiceOver 수동 검사를 수행한다.
- [x] 지정한 `codelily98/blog-codelily` Git 저장소에 기존 이력을 보존해 연결했다. 한글 커밋으로 소스·lockfile·문서를 동기화한다.
- [ ] 별도 통합 admin·이력서·독립 소개 서비스는 각각의 프로젝트 문서를 따라 구현한다.

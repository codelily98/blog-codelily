# common-react: 공통 React 기반

상태: 첫 소비 서비스에 구현·검증 완료, 두 번째 서비스 재사용 검증 대기 · 선행 문서: 루트 AGENTS, 아키텍처 결정 기록

## 단계

- [x] workspace·패키지 책임·소비 규칙 정의
- [x] UI 토큰, Tailwind, 라이트/다크, Button·Field·Dialog·Toast·Spinner
- [x] SunEditor wrapper: client-only 초기화/파괴, HTML/Markdown 원본, 편집 label·키보드, 읽기 스타일
- [x] 콘텐츠: GFM 변환·서버 sanitize·허용 inline CSS·XSS 검사
- [x] Chart: react-chartjs-2 + 텍스트 요약·동일 데이터 표
- [x] Grid: Tabulator + 키보드/스크린리더용 표·명시적 pagination/한도
- [x] R2: S3 adapter·서명 업로드·HEAD 검증·권한부 다운로드
- [x] 타입·경계·콘텐츠/SQL·브라우저 검사와 lockfile 버전 고정
- [ ] 두 번째 소비 앱에서 재사용 검증
- [ ] 실제 R2 계정에서 서명 업로드/다운로드·CORS 검증

## 완료 기준

공개 API를 통해 앱에서 사용할 수 있고 앱의 domain type을 공통 패키지가 import하지 않아야 한다. 외부 UI library는 해당 wrapper 내부에서만 import한다. imperative library는 mount·update·unmount를 모두 처리한다. 로딩·실패·빈 상태·대체 콘텐츠가 있어야 한다. 일반 공개 페이지 bundle에서 editor/chart/grid가 분리되어야 한다.

## 다음 시작점·기록

2026-11-03 후속: 실제 R2에서 서명 PUT·허용 Origin CORS·공개 복사/바이트 일치·서명 비공개 GET/no-store·익명 접근 거부·위장 파일 거절 통과. storage 보완 이미지도 운영 반영했다. 최신 도구의 비허용 Origin·정확한 형식 오류 조건과 공개 CDN HIT는 Cache Rule 배포 후 함께 검증한다. Google 에디터 실제 브라우저 전송과 두 번째 앱 재사용은 별도 대기다.

2026-11-03: 공통 R2 presigner의 빈 본문 CRC32 문제를 재현·보완하고 type/length 서명과 public/private bucket 분리를 검증했다. 전체 테스트 7개·타입·경계 통과. 실제 계정 검증은 [R2 연동 절차](../operations/R2-연동.md)를 따라 키/CORS 등록 후 수행한다.

2026-11-02: 공통 UI·편집·콘텐츠·Chart/Grid를 code-lily에서 실제 사용했다. SunEditor 도구 이름, Chart canvas 이름, Tabulator ARIA 구조와 키보드 정렬을 wrapper에서 보완했다. 기본 표/대화형 Grid 양쪽 자동 접근성 검사 통과. 후속 작업은 공통 패키지를 복사하지 않고 workspace dependency로 추가한다.

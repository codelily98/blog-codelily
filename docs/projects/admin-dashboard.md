# admin-dashboard: 통합 관리자

상태: 후속 프로젝트. 현재 code-lily의 자체 관리 화면과 telemetry 계약을 먼저 검증한다.

- [ ] 독립 Next.js 앱·admin 스키마·별도 Google session·OWNER/MFA 정책
- [ ] 공통 Chart/Grid/Dialog/Toast 재사용
- [ ] 서비스 등록·상태·버전 계약·단기 인증 또는 개별 service token
- [ ] 기간별 방문·고유 브라우저·사용자 발자취·업무 감사 조회
- [ ] 앱별 deadline·응답 상한·unavailable/stale 상태, 개인정보 접근 감사
- [ ] 앱 원본 DB 직접 접근 금지·Docker socket 제공 금지
- [ ] 통합 로그인·내부 API·권한·장애·접근성 검사

완료 기준: 한 앱의 장애가 다른 앱 및 admin 조회 전체를 중단하지 않고, 유실·미수집 통계를 0으로 오인시키지 않는다. 후속 작업 시작 시 `packages/contracts`와 code-lily의 내부 API를 확인한다.
